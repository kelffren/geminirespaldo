begin;

insert into public.permission_definitions(permission_key,description) values
  ('economy.manage','Ajustar KC y oro desde el panel administrativo'),
  ('accounts.live_control','Ejecutar acciones GM en sesiones de jugadores')
on conflict(permission_key) do update set description=excluded.description;

insert into public.role_permissions(role_key,permission_key) values
  ('admin','economy.manage'),
  ('admin','accounts.live_control')
on conflict do nothing;

create table if not exists public.account_runtime_commands (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check(action in ('kill','kick')),
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '10 minutes'),
  consumed_at timestamptz,
  constraint account_runtime_commands_reason_length check(char_length(reason) between 1 and 500)
);
create index if not exists account_runtime_commands_target_pending_idx
  on public.account_runtime_commands(target_user_id,created_at)
  where consumed_at is null;

alter table public.account_runtime_commands enable row level security;
revoke all on public.account_runtime_commands from anon,authenticated;
grant select on public.account_runtime_commands to authenticated;

drop policy if exists account_runtime_commands_read_own on public.account_runtime_commands;
create policy account_runtime_commands_read_own
  on public.account_runtime_commands for select to authenticated
  using((select auth.uid()) is not null and target_user_id=(select auth.uid()));

create or replace function public.admin_get_account_wallet(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_character_id uuid;
  v_character_name text;
  v_kc bigint:=0;
  v_gold bigint:=0;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (kelo_private.has_permission('accounts.view') or kelo_private.has_permission('economy.manage')) then raise exception 'ADMIN_PERMISSION_DENIED'; end if;
  select c.id,c.name into v_character_id,v_character_name
  from public.characters c
  where c.account_id=p_user_id and c.status='active'
  order by c.last_seen_at desc nulls last,c.created_at desc
  limit 1;
  if v_character_id is null then raise exception 'ACTIVE_CHARACTER_NOT_FOUND'; end if;
  select
    coalesce(max(w.amount) filter(where w.currency_key='kc'),0),
    coalesce(max(w.amount) filter(where w.currency_key='gold'),0)
  into v_kc,v_gold
  from public.character_wallets w
  where w.character_id=v_character_id and w.currency_key in ('kc','gold');
  return jsonb_build_object('character_id',v_character_id,'character_name',v_character_name,'kc',v_kc,'gold',v_gold);
end;
$$;
revoke all on function public.admin_get_account_wallet(uuid) from public,anon;
grant execute on function public.admin_get_account_wallet(uuid) to authenticated,service_role;

create or replace function public.admin_adjust_account_currency(
  p_user_id uuid,
  p_currency_key text,
  p_delta bigint,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=(select auth.uid());
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_currency text:=lower(trim(coalesce(p_currency_key,'')));
  v_character_id uuid;
  v_character_name text;
  v_correlation uuid:=gen_random_uuid();
  v_ledger public.wallet_ledger;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.has_permission('economy.manage') then raise exception 'ADMIN_PERMISSION_DENIED'; end if;
  if not exists(select 1 from auth.users u where u.id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if v_currency not in ('kc','gold') then raise exception 'CURRENCY_NOT_ALLOWED'; end if;
  if p_delta is null or p_delta=0 or abs(p_delta)>1000000000 then raise exception 'INVALID_DELTA'; end if;
  if v_reason is null then raise exception 'ADMIN_REASON_REQUIRED'; end if;

  select c.id,c.name into v_character_id,v_character_name
  from public.characters c
  where c.account_id=p_user_id and c.status='active'
  order by c.last_seen_at desc nulls last,c.created_at desc
  limit 1;
  if v_character_id is null then raise exception 'ACTIVE_CHARACTER_NOT_FOUND'; end if;

  select * into v_ledger from public.apply_wallet_delta(
    v_character_id,
    v_currency,
    p_delta,
    'admin_adjust_'||v_currency,
    v_correlation,
    jsonb_build_object('admin_user_id',v_actor,'target_user_id',p_user_id,'reason',left(v_reason,500))
  );

  insert into public.account_admin_audit_events(actor_user_id,target_user_id,action,reason,metadata)
  values(v_actor,p_user_id,'economy.adjust',left(v_reason,500),jsonb_build_object(
    'character_id',v_character_id,'character_name',v_character_name,'currency',v_currency,
    'delta',p_delta,'balance_after',v_ledger.balance_after,'correlation_id',v_correlation
  ));

  return jsonb_build_object(
    'ok',true,'user_id',p_user_id,'character_id',v_character_id,'character_name',v_character_name,
    'currency',v_currency,'delta',p_delta,'balance_after',v_ledger.balance_after,'ledger_id',v_ledger.id
  );
end;
$$;
revoke all on function public.admin_adjust_account_currency(uuid,text,bigint,text) from public,anon;
grant execute on function public.admin_adjust_account_currency(uuid,text,bigint,text) to authenticated,service_role;

create or replace function public.admin_issue_live_action(
  p_user_id uuid,
  p_action text,
  p_duration_seconds integer default 0,
  p_reason text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=(select auth.uid());
  v_action text:=lower(trim(coalesce(p_action,'')));
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_duration integer:=greatest(0,least(coalesce(p_duration_seconds,0),2592000));
  v_command_id uuid;
  v_until timestamptz;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.has_permission('accounts.live_control') then raise exception 'ADMIN_PERMISSION_DENIED'; end if;
  if p_user_id=v_actor then raise exception 'CANNOT_LIVE_CONTROL_SELF'; end if;
  if not exists(select 1 from auth.users u where u.id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if exists(select 1 from public.account_roles ar where ar.user_id=p_user_id and ar.role_key='admin') then raise exception 'CANNOT_LIVE_CONTROL_ADMIN'; end if;
  if v_action not in ('kill','kick') then raise exception 'INVALID_LIVE_ACTION'; end if;
  if v_reason is null then raise exception 'ADMIN_REASON_REQUIRED'; end if;
  if v_action='kill' and v_duration<>0 then raise exception 'KILL_DURATION_NOT_ALLOWED'; end if;

  if v_action='kick' and v_duration>0 then
    if not kelo_private.has_permission('accounts.moderate') then raise exception 'MODERATION_PERMISSION_REQUIRED'; end if;
    v_until:=now()+make_interval(secs=>v_duration);
    insert into public.account_moderation(user_id,status,reason,expires_at,updated_by)
    values(p_user_id,'suspended',left(v_reason,500),v_until,v_actor)
    on conflict(user_id) do update set
      status='suspended',reason=excluded.reason,expires_at=excluded.expires_at,updated_by=excluded.updated_by,updated_at=now();
  end if;

  insert into public.account_runtime_commands(target_user_id,action,reason,payload,created_by,expires_at)
  values(
    p_user_id,v_action,left(v_reason,500),
    jsonb_build_object('duration_seconds',v_duration,'suspended_until',v_until),
    v_actor,now()+interval '10 minutes'
  ) returning id into v_command_id;

  insert into public.account_admin_audit_events(actor_user_id,target_user_id,action,reason,metadata)
  values(v_actor,p_user_id,'live.'||v_action,left(v_reason,500),jsonb_build_object(
    'command_id',v_command_id,'duration_seconds',v_duration,'suspended_until',v_until
  ));

  return jsonb_build_object('ok',true,'command_id',v_command_id,'action',v_action,'duration_seconds',v_duration,'suspended_until',v_until);
end;
$$;
revoke all on function public.admin_issue_live_action(uuid,text,integer,text) from public,anon;
grant execute on function public.admin_issue_live_action(uuid,text,integer,text) to authenticated,service_role;

create or replace function public.get_my_runtime_commands()
returns table(id uuid,action text,reason text,payload jsonb,created_at timestamptz,expires_at timestamptz)
language plpgsql volatile security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return query
  select c.id,c.action,c.reason,c.payload,c.created_at,c.expires_at
  from public.account_runtime_commands c
  where c.target_user_id=v_uid and c.consumed_at is null and c.expires_at>now()
  order by c.created_at asc
  limit 20;
end;
$$;
revoke all on function public.get_my_runtime_commands() from public,anon;
grant execute on function public.get_my_runtime_commands() to authenticated,service_role;

create or replace function public.consume_my_runtime_command(p_command_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_changed integer:=0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.account_runtime_commands
  set consumed_at=coalesce(consumed_at,now())
  where id=p_command_id and target_user_id=v_uid and consumed_at is null;
  get diagnostics v_changed=row_count;
  return v_changed>0;
end;
$$;
revoke all on function public.consume_my_runtime_command(uuid) from public,anon;
grant execute on function public.consume_my_runtime_command(uuid) to authenticated,service_role;

comment on table public.account_runtime_commands is 'Short-lived, audited GM commands. Issuance is server-authorized by SECURITY DEFINER RPC; target clients may only read their own rows.';

-- Realtime is optional. The client also has a slow RPC fallback, so a missing publication never blocks login/gameplay.
do $$
begin
  alter publication supabase_realtime add table public.account_runtime_commands;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

commit;
