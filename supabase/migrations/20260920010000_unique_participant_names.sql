-- Prevent equivalent participant names inside the same Cup without rewriting
-- historical data. The application performs the same check for friendly
-- feedback; this trigger also protects direct and concurrent writes.

create extension if not exists unaccent with schema extensions;

create or replace function public.participant_name_key(input_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
return lower(regexp_replace(extensions.unaccent(trim(input_name)), '[[:space:]]+', ' ', 'g'));

create or replace function public.reject_duplicate_participant_name()
returns trigger
language plpgsql
set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.cup_id::text, 0));

  -- Allow unrelated edits to historical duplicate rows. A name-key change is
  -- still checked, so existing data can be corrected incrementally.
  if tg_op = 'UPDATE'
     and new.cup_id = old.cup_id
     and public.participant_name_key(new.name) = public.participant_name_key(old.name) then
    return new;
  end if;

  if exists (
    select 1
    from public.cup_entries existing
    where existing.cup_id = new.cup_id
      and existing.id <> new.id
      and public.participant_name_key(existing.name) = public.participant_name_key(new.name)
  ) then
    raise exception 'A participant with an equivalent name already exists in this cup'
      using errcode = '23505', constraint = 'cup_entries_unique_normalized_name';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_duplicate_participant_name on public.cup_entries;
create trigger reject_duplicate_participant_name
before insert or update of cup_id, name on public.cup_entries
for each row execute function public.reject_duplicate_participant_name();
