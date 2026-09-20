create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,40}$'),
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.cups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique,
  title text not null check (length(trim(title)) between 1 and 120),
  description text,
  cover_url text,
  participant_count integer not null check (participant_count in (4, 8, 16, 32, 64)),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.cup_entries (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  image_url text,
  external_url text,
  created_at timestamptz not null default now()
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id),
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed')),
  champion_entry_id uuid references public.cup_entries(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  round_number integer not null check (round_number >= 1),
  position integer not null check (position >= 1),
  participant_a_id uuid references public.cup_entries(id),
  participant_b_id uuid references public.cup_entries(id),
  winner_entry_id uuid references public.cup_entries(id),
  next_match_id uuid references public.matches(id),
  next_slot text check (next_slot in ('a', 'b')),
  unique (run_id, round_number, position),
  check ((next_match_id is null) = (next_slot is null)),
  check (participant_a_id is null or participant_b_id is null or participant_a_id <> participant_b_id),
  check (winner_entry_id is null or
    (participant_a_id is not null and participant_b_id is not null and
     (winner_entry_id = participant_a_id or winner_entry_id = participant_b_id)))
);

create index cup_entries_cup_id_idx on public.cup_entries(cup_id);
create index runs_cup_id_idx on public.runs(cup_id);
create index runs_user_id_idx on public.runs(user_id);
create index matches_run_id_idx on public.matches(run_id);
create index matches_next_match_id_idx on public.matches(next_match_id);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, 'user_' || replace(new.id::text, '-', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

create function public.guard_cup_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' and
    (new.owner_id is distinct from old.owner_id or
     new.slug is distinct from old.slug or
     new.participant_count is distinct from old.participant_count) then
    raise exception 'Published cup structure is immutable';
  end if;
  if old.status = 'archived' and new.status <> 'archived' then
    raise exception 'Archived cups cannot be republished';
  end if;
  if old.status = 'draft' and new.status = 'published' then
    if (select count(*) from public.cup_entries where cup_id = old.id) <> old.participant_count then
      raise exception 'Cup must have exactly % entries', old.participant_count;
    end if;
    new.published_at := now();
  else
    new.published_at := old.published_at;
  end if;
  if old.status = 'published' and new.status = 'draft' then
    raise exception 'Published cups cannot return to draft';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_cup_update
before update on public.cups for each row execute function public.guard_cup_update();

create function public.guard_entry_change()
returns trigger language plpgsql set search_path = '' as $$
declare target_cup_id uuid;
begin
  target_cup_id := coalesce(new.cup_id, old.cup_id);
  if (select status from public.cups where id = target_cup_id for update) <> 'draft' then
    raise exception 'Entries can only change in draft cups';
  end if;
  if tg_op = 'UPDATE' and new.cup_id <> old.cup_id then
    raise exception 'Entries cannot move between cups';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_entry_change
before insert or update or delete on public.cup_entries
for each row execute function public.guard_entry_change();

alter table public.profiles enable row level security;
alter table public.cups enable row level security;
alter table public.cup_entries enable row level security;
alter table public.runs enable row level security;
alter table public.matches enable row level security;

create policy "Profiles are public" on public.profiles for select using (true);
create policy "Users update own profile" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Published cups and own cups are readable" on public.cups for select
using (status = 'published' or owner_id = (select auth.uid()));
create policy "Users create own draft cups" on public.cups for insert to authenticated
with check (owner_id = (select auth.uid()) and status = 'draft');
create policy "Owners update own cups" on public.cups for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete own drafts" on public.cups for delete to authenticated
using (owner_id = (select auth.uid()) and status = 'draft');

create policy "Published and own entries are readable" on public.cup_entries for select
using (exists (select 1 from public.cups c where c.id = cup_id and
  (c.status = 'published' or c.owner_id = (select auth.uid()))));
create policy "Owners insert draft entries" on public.cup_entries for insert to authenticated
with check (exists (select 1 from public.cups c where c.id = cup_id and c.owner_id = (select auth.uid()) and c.status = 'draft'));
create policy "Owners update draft entries" on public.cup_entries for update to authenticated
using (exists (select 1 from public.cups c where c.id = cup_id and c.owner_id = (select auth.uid()) and c.status = 'draft'))
with check (exists (select 1 from public.cups c where c.id = cup_id and c.owner_id = (select auth.uid()) and c.status = 'draft'));
create policy "Owners delete draft entries" on public.cup_entries for delete to authenticated
using (exists (select 1 from public.cups c where c.id = cup_id and c.owner_id = (select auth.uid()) and c.status = 'draft'));

-- Runs and matches intentionally have no browser write policies. Server-side
-- operations and the scoped read rules arrive with the run milestone.
