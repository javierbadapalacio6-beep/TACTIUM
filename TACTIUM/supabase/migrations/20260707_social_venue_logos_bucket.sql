-- Bucket público para logos de sedes + policies. Path = `{user_id}/logo_*`
-- (la primera carpeta del path = auth.uid(), igual que el bucket avatars).
insert into storage.buckets (id, name, public)
values ('venue-logos', 'venue-logos', true)
on conflict (id) do nothing;

create policy "venue-logos public read"
  on storage.objects for select
  using (bucket_id = 'venue-logos');

create policy "venue-logos owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'venue-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "venue-logos owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'venue-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "venue-logos owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'venue-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
