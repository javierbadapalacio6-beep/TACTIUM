-- Extiende create_venue para guardar los datos que devuelve Google Places
-- (dirección, ciudad, provincia, coords, web, place_id). Si ya existe una
-- ficha con ese external_id, la RECLAMA (no duplica).
-- Requiere: columnas website/lat/lng/external_id en venues (migración
-- social_venues_web_coords ya aplicada).
drop function if exists public.create_venue(text, text, text);

create or replace function public.create_venue(
  p_name        text,
  p_location    text default '',
  p_logo_url    text default '',
  p_city        text default '',
  p_province    text default '',
  p_lat         double precision default null,
  p_lng         double precision default null,
  p_website     text default '',
  p_external_id text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_ext text := nullif(trim(p_external_id), '');
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'name required';
  end if;

  -- Reclama la ficha del directorio si ya existe ese place_id (evita duplicados).
  if v_ext is not null then
    update public.venues
       set owner_id   = auth.uid(),
           source     = 'user',
           name       = trim(p_name),
           location   = coalesce(nullif(trim(p_location), ''), location),
           logo_url   = coalesce(nullif(trim(p_logo_url), ''), logo_url),
           city       = coalesce(nullif(trim(p_city), ''), city),
           province   = coalesce(nullif(trim(p_province), ''), province),
           lat        = coalesce(p_lat, lat),
           lng        = coalesce(p_lng, lng),
           website    = coalesce(nullif(trim(p_website), ''), website),
           updated_at = now()
     where external_id = v_ext
     returning id into v_id;
  end if;

  if v_id is null then
    insert into public.venues (
      owner_id, name, location, logo_url, city, province, lat, lng, website, external_id, source
    ) values (
      auth.uid(), trim(p_name), nullif(trim(p_location), ''), nullif(trim(p_logo_url), ''),
      nullif(trim(p_city), ''), nullif(trim(p_province), ''), p_lat, p_lng,
      nullif(trim(p_website), ''), v_ext, 'user'
    )
    returning id into v_id;
  end if;

  update public.profiles set onboarded = true, updated_at = now() where id = auth.uid();
  return v_id;
end;
$$;

revoke all on function public.create_venue(text, text, text, text, text, double precision, double precision, text, text) from public;
grant execute on function public.create_venue(text, text, text, text, text, double precision, double precision, text, text) to authenticated;
