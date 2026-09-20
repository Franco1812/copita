create index if not exists runs_completed_cup_id_idx
on public.runs (cup_id, id) where status = 'completed';

create function public.cup_ranking(p_cup_id uuid)
returns table (
  entry_id uuid,
  championships bigint,
  match_wins bigint,
  match_appearances bigint,
  completed_runs bigint
)
language sql stable security definer set search_path = '' as $$
  with finished as (
    select r.id, r.champion_entry_id
    from public.runs r
    where r.cup_id = p_cup_id and r.status = 'completed'
  ),
  title_counts as (
    select f.champion_entry_id as entry_id, count(*) as championships
    from finished f
    group by f.champion_entry_id
  ),
  match_counts as (
    select participant.entry_id,
      count(*) filter (where m.winner_entry_id = participant.entry_id) as match_wins,
      count(*) as match_appearances
    from finished f
    join public.matches m on m.run_id = f.id
    cross join lateral (values (m.participant_a_id), (m.participant_b_id)) as participant(entry_id)
    where participant.entry_id is not null and m.winner_entry_id is not null
    group by participant.entry_id
  ),
  total as (select count(*) as completed_runs from finished)
  select e.id,
    coalesce(t.championships, 0),
    coalesce(mc.match_wins, 0),
    coalesce(mc.match_appearances, 0),
    total.completed_runs
  from public.cup_entries e
  join public.cups c on c.id = e.cup_id and c.status = 'published'
  cross join total
  left join title_counts t on t.entry_id = e.id
  left join match_counts mc on mc.entry_id = e.id
  where e.cup_id = p_cup_id;
$$;

revoke all on function public.cup_ranking(uuid) from public, anon, authenticated;
grant execute on function public.cup_ranking(uuid) to anon, authenticated;
