-- Aplicar a un club una suscripción de club YA PAGADA.
--
-- Una compra pertenece a la cuenta de la tienda, no a la cuenta de TACTIUM.
-- Cuando alguien borra su cuenta y se da de alta otra vez, o crea un club
-- nuevo, la compra sigue viva pero apunta a otro sitio (o a nada), y la app le
-- enseñaba la pasarela por algo ya pagado. Con esto puede decir «aplícala aquí»
-- en vez de volver a pasar por caja.
--
-- Solo mueve el sujeto de la suscripción: ni cambia el plan, ni las fechas, ni
-- toca la tienda. Cambiar de plan sigue siendo una acción aparte y explícita.

create or replace function public.apply_subscription_to_club(p_club_id uuid)
returns subscriptions
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_caller uuid := auth.uid();
  v_sub    public.subscriptions;
begin
  if v_caller is null then
    raise exception 'Debes iniciar sesión';
  end if;

  -- Solo quien manda en el club puede cubrirlo.
  if not exists (
    select 1 from public.clubs c
     where c.id = p_club_id and c.owner_id = v_caller
    union
    select 1 from public.club_members cm
     where cm.club_id = p_club_id and cm.user_id = v_caller and cm.role = 'admin'
  ) then
    raise exception 'No administras ese club'
      using errcode = 'insufficient_privilege';
  end if;

  -- Suscripción de CLUB pagada por quien llama y todavía viva. Si tuviera
  -- varias, la de vencimiento más lejano.
  select * into v_sub
    from public.subscriptions s
   where s.payer_user_id = v_caller
     and s.plan_tier in ('club_starter','club_pro','club_elite')
     and s.status in ('trialing','active','grace_period')
     and s.current_period_end > now()
   order by s.current_period_end desc
   limit 1;

  if v_sub.id is null then
    raise exception 'No tienes ninguna suscripción de club activa';
  end if;

  -- Ya cubre este club: nada que hacer (idempotente).
  if v_sub.subject_type = 'club' and v_sub.subject_id = p_club_id then
    return v_sub;
  end if;

  -- No robarle la cobertura a un club que ya tenga la suya.
  if exists (
    select 1 from public.subscriptions s2
     where s2.subject_type = 'club'
       and s2.subject_id = p_club_id
       and s2.id <> v_sub.id
       and s2.status in ('trialing','active','grace_period')
       and s2.current_period_end > now()
  ) then
    raise exception 'Ese club ya tiene una suscripción activa';
  end if;

  update public.subscriptions
     set subject_type = 'club',
         subject_id   = p_club_id,
         updated_at   = now()
   where id = v_sub.id
   returning * into v_sub;

  insert into public.subscription_events
    (subscription_id, event_type, payload, processed_at)
  values (v_sub.id, 'APPLIED_TO_CLUB',
          jsonb_build_object('club_id', p_club_id, 'by', v_caller::text),
          now());

  return v_sub;
end;
$function$;

revoke execute on function public.apply_subscription_to_club(uuid) from public, anon;
grant  execute on function public.apply_subscription_to_club(uuid) to authenticated;

comment on function public.apply_subscription_to_club(uuid) is
  'Apunta al club indicado la suscripción de club ya pagada por quien llama. No cambia plan ni fechas.';
