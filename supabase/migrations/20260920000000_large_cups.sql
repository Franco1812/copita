-- Cups of any size from 4 to 150. Sizes that are not a power of two open with a
-- short preliminary round; the participants that skip it are seeded straight
-- into round two, so the bracket validation can no longer assume full rounds.

alter table public.cups drop constraint if exists cups_participant_count_check;
alter table public.cups add constraint cups_participant_count_check
check (participant_count between 4 and 150);

create or replace function public.create_bracket_run(
  p_run_id uuid,
  p_cup_id uuid,
  p_user_id uuid,
  p_access_token_hash text,
  p_matches jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_size integer;
  v_rounds integer := 0;
  v_bracket integer := 1;
  v_match_count integer;
  v_seeded_ids uuid[];
  v_entry_ids uuid[];
begin
  select participant_count into v_size
  from public.cups where id = p_cup_id and status = 'published' for share;
  if v_size is null then raise exception 'Cup is not published'; end if;
  if (p_user_id is null) = (p_access_token_hash is null) then
    raise exception 'Run needs exactly one owner mechanism';
  end if;
  if p_access_token_hash is not null and p_access_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid access token hash';
  end if;

  -- Rounds of the smallest power-of-two bracket that fits the Cup.
  while v_bracket < v_size loop
    v_bracket := v_bracket * 2;
    v_rounds := v_rounds + 1;
  end loop;

  select count(*) into v_match_count from jsonb_array_elements(p_matches);
  if v_match_count <> v_size - 1 then raise exception 'Invalid number of matches'; end if;

  select array_agg(id order by id) into v_entry_ids
  from public.cup_entries where cup_id = p_cup_id;
  if cardinality(v_entry_ids) <> v_size then raise exception 'Cup entry count changed'; end if;

  -- Seeded slots live in round one and, for byes, in round two.
  select array_agg(entry_id order by entry_id) into v_seeded_ids
  from (
    select (item->>'participant_a_id')::uuid as entry_id
    from jsonb_array_elements(p_matches) item where item->>'participant_a_id' is not null
    union all
    select (item->>'participant_b_id')::uuid as entry_id
    from jsonb_array_elements(p_matches) item where item->>'participant_b_id' is not null
  ) seeded;
  if v_seeded_ids is distinct from v_entry_ids then
    raise exception 'Seeded slots must hold each cup entry exactly once';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_matches) as m(
      round_number integer, position integer, next_match_id uuid, next_slot text
    ) where
      round_number is null or round_number < 1 or round_number > v_rounds or
      position is null or position < 1 or position > v_size or
      (next_match_id is null) <> (next_slot is null) or
      (next_slot is not null and next_slot not in ('a', 'b'))
  ) then raise exception 'Invalid bracket structure'; end if;

  insert into public.runs (id, cup_id, user_id, access_token_hash)
  values (p_run_id, p_cup_id, p_user_id, p_access_token_hash);

  insert into public.matches (
    id, run_id, round_number, position, participant_a_id, participant_b_id
  )
  select id, p_run_id, round_number, position, participant_a_id, participant_b_id
  from jsonb_to_recordset(p_matches) as m(
    id uuid, round_number integer, position integer,
    participant_a_id uuid, participant_b_id uuid
  );

  update public.matches target
  set next_match_id = source.next_match_id, next_slot = source.next_slot
  from jsonb_to_recordset(p_matches) as source(
    id uuid, next_match_id uuid, next_slot text
  )
  where target.id = source.id and target.run_id = p_run_id;

  -- Every link stays inside the run and moves exactly one round forward.
  if exists (
    select 1 from public.matches current_match
    left join public.matches next_match on next_match.id = current_match.next_match_id
    where current_match.run_id = p_run_id and current_match.next_match_id is not null
      and (next_match.id is null or next_match.run_id <> p_run_id
           or next_match.round_number <> current_match.round_number + 1)
  ) then raise exception 'Invalid next-match linkage'; end if;

  -- Exactly one final, and it sits in the last round.
  if (select count(*) from public.matches
      where run_id = p_run_id and next_match_id is null) <> 1
     or exists (select 1 from public.matches
                where run_id = p_run_id and next_match_id is null and round_number <> v_rounds)
  then raise exception 'A bracket needs exactly one final'; end if;

  -- No two matches feed the same slot.
  if exists (
    select 1 from public.matches
    where run_id = p_run_id and next_match_id is not null
    group by next_match_id, next_slot having count(*) > 1
  ) then raise exception 'Two matches feed the same slot'; end if;

  -- Each slot is either seeded or fed by one earlier match, never both or neither.
  -- With the match count and the seeded-entry check above, this forces a single
  -- elimination tree whatever the byes look like.
  if exists (
    select 1 from public.matches m
    cross join lateral (values ('a'::text, m.participant_a_id), ('b'::text, m.participant_b_id))
      as slot(slot_name, seeded_entry)
    where m.run_id = p_run_id
      and (slot.seeded_entry is not null) = exists (
        select 1 from public.matches feeder
        where feeder.run_id = p_run_id and feeder.next_match_id = m.id and feeder.next_slot = slot.slot_name
      )
  ) then raise exception 'Every bracket slot needs exactly one source'; end if;

  return p_run_id;
end;
$$;

revoke all on function public.create_bracket_run(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_bracket_run(uuid, uuid, uuid, text, jsonb) to service_role;

-- Carry the signup name into the profile so signing in does not need an extra
-- round trip to backfill it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || replace(new.id::text, '-', ''),
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), 80), '')
  );
  return new;
end;
$$;

-- The per-row limit trigger counts against the statement's snapshot, so it
-- cannot see earlier rows of the same multi-row insert. Pasting a list of
-- participants does exactly that, so re-check the total once per statement.
create or replace function public.limit_draft_entries_statement()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1
    from (select distinct cup_id from new_rows) touched
    join public.cups c on c.id = touched.cup_id
    where (select count(*) from public.cup_entries e where e.cup_id = c.id) > c.participant_count
  ) then
    raise exception 'Cup has reached its participant limit';
  end if;
  return null;
end;
$$;

drop trigger if exists limit_draft_entries_statement on public.cup_entries;
create trigger limit_draft_entries_statement
after insert on public.cup_entries
referencing new table as new_rows
for each statement execute function public.limit_draft_entries_statement();
