-- Las RPC de disponibilidad solo para usuarios con sesión (aviso del
-- security advisor: SECURITY DEFINER ejecutable por `anon`). Por dentro ya
-- exigían auth.uid(); esto cierra también la puerta de entrada.
revoke execute on function public.availability_maybe_deadline(uuid) from public, anon;
revoke execute on function public.respond_availability(uuid, uuid, text, text, text) from public, anon;
revoke execute on function public.clear_availability(uuid, uuid) from public, anon;
revoke execute on function public.remind_pending_availability(uuid) from public, anon;
grant execute on function public.availability_maybe_deadline(uuid) to authenticated;
grant execute on function public.respond_availability(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.clear_availability(uuid, uuid) to authenticated;
grant execute on function public.remind_pending_availability(uuid) to authenticated;
