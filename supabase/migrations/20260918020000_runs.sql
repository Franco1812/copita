alter table public.runs
add column access_token_hash text check (access_token_hash is null or access_token_hash ~ '^[a-f0-9]{64}$');

alter table public.runs
add constraint runs_owner_or_token_check check (
  (user_id is not null and access_token_hash is null) or
  (user_id is null and access_token_hash is not null)
);

create function public.create_bracket_run(
  p_run_id uuid,
  p_cup_id uuid,
  p_user_id uuid,
  p_access_token_hash text,
  p_matches jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_size integer;
  v_match_count integer;
  v_first_round_ids uuid[];
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

  select count(*) into v_match_count from jsonb_array_elements(p_matches);
  if v_match_count <> v_size - 1 then raise exception 'Invalid number of matches'; end if;

  select array_agg(id order by id) into v_entry_ids
  from public.cup_entries where cup_id = p_cup_id;
  if cardinality(v_entry_ids) <> v_size then raise exception 'Cup entry count changed'; end if;

  select array_agg(entry_id order by entry_id) into v_first_round_ids
  from (
    select (item->>'participant_a_id')::uuid as entry_id
    from jsonb_array_elements(p_matches) item where (item->>'round_number')::integer = 1
    union all
    select (item->>'participant_b_id')::uuid as entry_id
    from jsonb_array_elements(p_matches) item where (item->>'round_number')::integer = 1
  ) initial_entries;
  if v_first_round_ids is distinct from v_entry_ids then
    raise exception 'Initial matches must contain each cup entry once';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_matches) as m(
      id uuid, round_number integer, position integer,
      participant_a_id uuid, participant_b_id uuid,
      next_match_id uuid, next_slot text
    ) where
      (round_number > 1 and (participant_a_id is not null or participant_b_id is not null)) or
      round_number < 1 or round_number > log(2, v_size) or
      position < 1 or position > v_size / power(2, round_number) or
      ((next_match_id is null) <> (round_number = log(2, v_size))) or
      (next_match_id is not null and next_slot is distinct from case when position % 2 = 1 then 'a' else 'b' end)
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

  if exists (
    select 1 from public.matches current_match
    join public.matches next_match on next_match.id = current_match.next_match_id
    where current_match.run_id = p_run_id and
      (next_match.run_id <> p_run_id or next_match.round_number <> current_match.round_number + 1 or
       next_match.position <> ceil(current_match.position::numeric / 2))
  ) then raise exception 'Invalid next-match linkage'; end if;

  return p_run_id;
end;
$$;

create function public.choose_bracket_winner(
  p_run_id uuid,
  p_match_id uuid,
  p_winner_entry_id uuid
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_run public.runs%rowtype;
  v_match public.matches%rowtype;
begin
  select * into v_run from public.runs where id = p_run_id for update;
  if not found or v_run.status <> 'active' then raise exception 'Run is not active'; end if;

  select * into v_match from public.matches
  where id = p_match_id and run_id = p_run_id for update;
  if not found then raise exception 'Match not found in run'; end if;
  if v_match.winner_entry_id is not null then raise exception 'Match already answered'; end if;
  if v_match.participant_a_id is null or v_match.participant_b_id is null then
    raise exception 'Match is not ready';
  end if;
  if p_winner_entry_id is distinct from v_match.participant_a_id and
     p_winner_entry_id is distinct from v_match.participant_b_id then
    raise exception 'Winner is not a participant';
  end if;

  update public.matches set winner_entry_id = p_winner_entry_id where id = p_match_id;

  if v_match.next_match_id is not null then
    if v_match.next_slot = 'a' then
      update public.matches set participant_a_id = p_winner_entry_id
      where id = v_match.next_match_id and run_id = p_run_id
        and participant_a_id is null and winner_entry_id is null;
    elsif v_match.next_slot = 'b' then
      update public.matches set participant_b_id = p_winner_entry_id
      where id = v_match.next_match_id and run_id = p_run_id
        and participant_b_id is null and winner_entry_id is null;
    else
      raise exception 'Next slot is missing';
    end if;
    if not found then raise exception 'Next slot is already occupied'; end if;
    return false;
  end if;

  update public.runs set
    status = 'completed', champion_entry_id = p_winner_entry_id, completed_at = now()
  where id = p_run_id;
  return true;
end;
$$;

revoke all on function public.create_bracket_run(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.choose_bracket_winner(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_bracket_run(uuid, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.choose_bracket_winner(uuid, uuid, uuid) to service_role;
