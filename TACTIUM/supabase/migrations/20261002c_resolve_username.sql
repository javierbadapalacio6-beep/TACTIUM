-- Traduce un @usuario (público por diseño) a su id, para las URLs /u/<usuario>
-- de la web. get_public_user_profile solo acepta el id; sin esto, los enlaces
-- por nombre de usuario (avisos de seguidor, «Perfil público») daban
-- «Perfil no disponible».
create or replace function public.resolve_username(p_username text)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id from public.profiles p
   where lower(p.username) = lower(btrim(coalesce(p_username, '')))
   limit 1;
$$;
revoke execute on function public.resolve_username(text) from public;
grant execute on function public.resolve_username(text) to anon, authenticated;
