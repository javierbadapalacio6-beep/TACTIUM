-- Editar una sede propia desde el Panel de sede. SECURITY DEFINER: valida
-- que el usuario es el owner. Campos null = no tocar (coalesce).
create or replace function public.update_venue(
  p_id          uuid,
  p_name        text default null,
  p_location    text default null,
  p_website     text default null,
  p_logo_url    text default null,
  p_city        text default null,
  p_province    text default null,
  p_lat         double precision default null,
  p_lng         double precision default null,
  p_external_id text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  update public.venues set
    name        = coalesce(nullif(trim(p_name), ''), name),
    location    = coalesce(p_location, location),
    website     = coalesce(p_website, website),
    logo_url    = coalesce(p_logo_url, logo_url),
    city        = coalesce(p_city, city),
    province    = coalesce(p_province, province),
    lat         = coalesce(p_lat, lat),
    lng         = coalesce(p_lng, lng),
    external_id = coalesce(nullif(trim(p_external_id), ''), external_id),
    updated_at  = now()
  where id = p_id and owner_id = auth.uid();

  if not found then
    raise exception 'venue not found or not owner';
  end if;
end;
$$;

revoke all on function public.update_venue(uuid, text, text, text, text, text, text, double precision, double precision, text) from public;
grant execute on function public.update_venue(uuid, text, text, text, text, text, text, double precision, double precision, text) to authenticated;
