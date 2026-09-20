insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('cup-assets', 'cup-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users upload images in own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('avatars', 'cup-assets') and
  (storage.foldername(name))[1] = (select auth.uid())::text and
  storage.extension(name) in ('jpg', 'png', 'webp')
);

create policy "Users delete own images"
on storage.objects for delete to authenticated
using (
  bucket_id in ('avatars', 'cup-assets') and
  (storage.foldername(name))[1] = (select auth.uid())::text
);

create function public.limit_draft_entries()
returns trigger language plpgsql set search_path = '' as $$
declare max_entries integer;
begin
  -- Serialize additions against publication and other additions.
  select participant_count into max_entries from public.cups where id = new.cup_id for update;
  if (select count(*) from public.cup_entries where cup_id = new.cup_id) >= max_entries then
    raise exception 'Cup has reached its participant limit';
  end if;
  return new;
end;
$$;

create trigger limit_draft_entries
before insert on public.cup_entries for each row execute function public.limit_draft_entries();
