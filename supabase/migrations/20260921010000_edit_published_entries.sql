-- Let owners correct descriptive fields (name, description, image, link) of
-- entries in published cups. Adding or removing entries stays draft-only, so
-- the bracket structure and participant count remain fixed after publishing.

create or replace function public.guard_entry_change()
returns trigger language plpgsql set search_path = '' as $$
declare
  target_cup_id uuid;
  target_status text;
begin
  target_cup_id := coalesce(new.cup_id, old.cup_id);

  if tg_op = 'UPDATE' then
    -- Updates do not change the entry count, so a shared lock is enough.
    select status into target_status from public.cups where id = target_cup_id for share;
    if target_status not in ('draft', 'published') then
      raise exception 'Entries can only change in draft or published cups';
    end if;
    if new.cup_id <> old.cup_id then
      raise exception 'Entries cannot move between cups';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'Entry creation date is immutable';
    end if;
  else
    select status into target_status from public.cups where id = target_cup_id for update;
    if target_status <> 'draft' then
      raise exception 'Entries can only change in draft cups';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop policy if exists "Owners update draft entries" on public.cup_entries;
create policy "Owners update draft and published entries" on public.cup_entries
for update to authenticated
using (exists (
  select 1 from public.cups c
  where c.id = cup_id and c.owner_id = (select auth.uid()) and c.status in ('draft', 'published')))
with check (exists (
  select 1 from public.cups c
  where c.id = cup_id and c.owner_id = (select auth.uid()) and c.status in ('draft', 'published')));
