-- Later rounds begin with both participant slots empty.
alter table public.matches drop constraint if exists matches_check1;
alter table public.matches add constraint matches_distinct_participants_check
check (
  participant_a_id is null or participant_b_id is null or
  participant_a_id <> participant_b_id
);
