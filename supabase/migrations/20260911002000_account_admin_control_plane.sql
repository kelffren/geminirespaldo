begin;

create table if not exists public.permission_definitions (
  permission_key text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

insert into public.permission_definitions(permission_key,description) values
  ('admin.panel','Abrir panel administrativo'),
  ('creators.access','Acceso a Kelo Creators'),
  ('world.edit','Editar mundos'),
  ('world.import','Importar mundos'),
  ('world.export','Exportar mundos'),
  ('world.publish','Publicar mundos'),
  ('animation.edit','Editar animaciones'),
  ('vfx.edit','Editar efectos visuales'),
  ('ability.edit','Editar habilidades'),
  ('accounts.view','Ver cuentas'),
  ('accounts.roles','Gestionar roles y permisos'),
  ('accounts.moderate','Suspender o bloquear cuentas'),
  ('audit.view','Consultar auditoría administrativa')
on conflict(permission_key) do update set description=excluded.description;

create table if not exists public.role_permissions (
  role_key text not null references public.role_definitions(role_key) on delete cascade,
  permission_key text not null references public.permission_definitions(permission_key) on delete cascade,
  primary key(role_key,permission_key)
);

insert into public.role_permissions(role_key,permission_key) values
  ('creator','creators.access'),('creator','world.edit'),('creator','world.import'),('creator','world.export'),('creator','animation.edit'),('creator','vfx.edit'),('creator','ability.edit'),
  ('moderator','accounts.view'),('moderator','accounts.moderate'),('moderator','audit.view'),
  ('official','world.publish'),
  ('admin','admin.panel'),('admin','creators.access'),('admin','world.edit'),('admin','world.import'),('admin','world.export'),('admin','world.publish'),('admin','animation.edit'),('admin','vfx.edit'),('admin','ability.edit'),('admin','accounts.view'),('admin','accounts.roles'),('admin','accounts.moderate'),('admin','audit.view')
on conflict do nothing;

create table if not exists public.account_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null references public.permission_definitions(permission_key) on delete cascade,
  enabled boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key(user_id,permission_key)
);
create index if not exists account_permissions_user_idx on public.account_permissions(user_id);

create table if not exists public.account_moderation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check(status in ('active','suspended','banned')),
  reason text,
  expires_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_moderation_reason_length check(reason is null or char_length(reason) <= 500)
);
create index if not exists account_moderation_status_idx on public.account_moderation(status,expires_at);

create table if not exists public.account_admin_audit_events (
  id bigserial primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists account_admin_audit_target_idx on public.account_admin_audit_events(target_user_id,created_at desc);
create index if not exists account_admin_audit_actor_idx on public.account_admin_audit_events(actor_user_id,created_at desc);

create or replace function kelo_private.permissions_for_user(p_user_id uuid)
returns text[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(pd.permission_key order by pd.permission_key),array[]::text[])
  from public.permission_definitions pd
  where
    exists(select 1 from public.account_permissions ap where ap.user_id=p_user_id and ap.permission_key=pd.permission_key and ap.enabled=true)
    or (
      not exists(select 1 from public.account_permissions ap where ap.user_id=p_user_id and ap.permission_key=pd.permission_key and ap.enabled=false)
      and exists(
        select 1 from public.account_roles ar
        join public.role_permissions rp on rp.role_key=ar.role_key
        where ar.user_id=p_user_id and rp.permission_key=pd.permission_key
      )
    );
$$;
revoke all on function kelo_private.permissions_for_user(uuid) from public,anon;
grant execute on function kelo_private.permissions_for_user(uuid) to authenticated,service_role;

create or replace function kelo_private.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path='' as $$
  select p_permission = any(kelo_private.permissions_for_user((select auth.uid())));
$$;
revoke all on function kelo_private.has_permission(text) from public,anon;
grant execute on function kelo_private.has_permission(text) to authenticated,service_role;

create or replace function public.get_my_account_access()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_uid uuid := (select auth.uid());
  v_status text := 'active';
  v_reason text;
  v_expires timestamptz;
  v_roles text[];
  v_permissions text[];
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select am.status,am.reason,am.expires_at into v_status,v_reason,v_expires from public.account_moderation am where am.user_id=v_uid;
  v_status:=coalesce(v_status,'active');
  if v_status='suspended' and v_expires is not null and v_expires<=now() then v_status:='active';v_reason:=null;v_expires:=null; end if;
  select coalesce(array_agg(ar.role_key order by ar.role_key),array[]::text[]) into v_roles from public.account_roles ar where ar.user_id=v_uid;
  v_permissions:=kelo_private.permissions_for_user(v_uid);
  return jsonb_build_object('user_id',v_uid,'status',v_status,'reason',v_reason,'expires_at',v_expires,'roles',to_jsonb(v_roles),'permissions',to_jsonb(v_permissions));
end;
$$;
revoke all on function public.get_my_account_access() from public,anon;
grant execute on function public.get_my_account_access() to authenticated,service_role;

create or replace function public.admin_search_accounts(p_query text default null,p_limit integer default 50)
returns table(
  user_id uuid,email text,display_name text,character_names text[],last_seen_at timestamptz,
  status text,reason text,expires_at timestamptz,roles text[],permissions text[]
) language plpgsql stable security definer set search_path='' as $$
declare v_q text:=nullif(trim(coalesce(p_query,'')),''); v_limit integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
  if not kelo_private.has_permission('accounts.view') then raise exception 'ADMIN_PERMISSION_DENIED'; end if;
  return query
  select u.id,u.email,p.display_name,
    coalesce(ch.names,array[]::text[]),ch.last_seen,
    case when am.status='suspended' and am.expires_at is not null and am.expires_at<=now() then 'active' else coalesce(am.status,'active') end,
    case when am.status='suspended' and am.expires_at is not null and am.expires_at<=now() then null else am.reason end,
    case when am.status='suspended' and am.expires_at is not null and am.expires_at<=now() then null else am.expires_at end,
    coalesce(r.roles,array[]::text[]),kelo_private.permissions_for_user(u.id)
  from auth.users u
  left join public.profiles p on p.user_id=u.id
  left join public.account_moderation am on am.user_id=u.id
  left join lateral (
    select array_agg(c.name order by c.created_at) as names,max(c.last_seen_at) as last_seen
    from public.characters c where c.account_id=u.id
  ) ch on true
  left join lateral (
    select array_agg(ar.role_key order by ar.role_key) as roles from public.account_roles ar where ar.user_id=u.id
  ) r on true
  where coalesce(u.is_anonymous,false)=false and (
    v_q is null or u.email ilike '%'||v_q||'%' or coalesce(p.display_name,'') ilike '%'||v_q||'%' or
    exists(select 1 from public.characters c2 where c2.account_id=u.id and c2.name ilike '%'||v_q||'%')
  )
  order by coalesce(ch.last_seen,u.created_at) desc
  limit v_limit;
end;
$$;
revoke all on function public.admin_search_accounts(text,integer) from public,anon;
grant execute on function public.admin_search_accounts(text,integer) to authenticated,service_role;

create or replace function public.admin_set_role(p_user_id uuid,p_role text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_target_is_admin boolean;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.has_permission('accounts.roles') then raise exception 'ADMIN_PERMISSION_DENIED'; end if;
  if not exists(select 1 from auth.users u where u.id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if not exists(select 1 from public.role_definitions rd where rd.role_key=p_role) then raise exception 'UNKNOWN_ROLE'; end if;
  if p_user_id=v_actor and p_role='admin' and not p_enabled then raise exception 'CANNOT_REMOVE_OWN_ADMIN'; end if;
  select exists(select 1 from public.account_roles ar where ar.user_id=p_user_id and ar.role_key='admin') into v_target_is_admin;
  if v_target_is_admin and not kelo_private.has_role('admin') then raise exception 'CANNOT_EDIT_ADMIN'; end if;
  if p_enabled then
    insert into public.account_roles(user_id,role_key,granted_by) values(p_user_id,p_role,v_actor) on conflict(user_id,role_key) do nothing;
  else
    delete from public.account_roles where user_id=p_user_id and role_key=p_role;
  end if;
  insert into public.account_admin_audit_events(actor_user_id,target_user_id,action,metadata) values(v_actor,p_user_id,case when p_enabled then 'role.grant' else 'role.revoke' end,jsonb_build_object('role',p_role));
  return jsonb_build_object('ok',true,'user_id',p_user_id,'role',p_role,'enabled',p_enabled);
end;
$$;
revoke all on function public.admin_set_role(uuid,text,boolean) from public,anon;
grant execute on function public.admin_set_role(uuid,text,boolean) to authenticated,service_role;

create or replace function public.admin_set_permission(p_user_id uuid,p_permission text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid());
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.has_permission('accounts.roles') then raise exception 'ADMIN_PERMISSION_DENIED'; end if;
  if not exists(select 1 from auth.users u where u.id=p_user_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if not exists(select 1 from public.permission_definitions pd where pd.permission_key=p_permission) then raise exception 'UNKNOWN_PERMISSION'; end if;
  insert into public.account_permissions(user_id,permission_key,enabled,granted_by,granted_at)
  values(p_user_id,p_permission,p_enabled,v_actor,now())
  on conflict(user_id,permission_key) do update set enabled=excluded.enabled,granted_by=excluded.granted_by,granted_at=excluded.granted_at;
  insert into public.account_admin_audit_events(actor_user_id,target_user_id,action,metadata) values(v_actor,p_user_id,case when p_enabled then 'permission.grant' else 'permission.revoke' end,jsonb_build_object('permission',p_permission));
  return jsonb_build_object('ok',true,'user_id',p_user_id,'permission',p_permission,'enabled',p_enabled);
end;
$$;
revoke all on function public.admin_set_permission(uuid,text,boolean) from public,anon;
grant execute on function public.admin_set_permission(uuid,text,boolean) to authenticated,service_role;

create or replace function public.admin_set_moderation(p_user_id uuid,p_status text,p_reason text default null,p_expires_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=(select auth.uid()); v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.has_permission('accounts.moderate') then raise exception 'ADMIN_PERMISSION_DENIED'; end if;
  if p_user_id=v_actor and p_status<>'active' then raise exception 'CANNOT_MODERATE_SELF'; end if;
  if exists(select 1 from public.account_roles ar where ar.user_id=p_user_id and ar.role_key='admin') and p_status<>'active' then raise exception 'CANNOT_MODERATE_ADMIN'; end if;
  if p_status is null or p_status not in ('active','suspended','banned') then raise exception 'INVALID_MODERATION_STATUS'; end if;
  if p_status='suspended' and (p_expires_at is null or p_expires_at<=now()) then raise exception 'SUSPENSION_EXPIRY_REQUIRED'; end if;
  if p_status<>'active' and v_reason is null then raise exception 'MODERATION_REASON_REQUIRED'; end if;
  insert into public.account_moderation(user_id,status,reason,expires_at,updated_by)
  values(p_user_id,p_status,case when p_status='active' then null else left(v_reason,500) end,case when p_status='suspended' then p_expires_at else null end,v_actor)
  on conflict(user_id) do update set status=excluded.status,reason=excluded.reason,expires_at=excluded.expires_at,updated_by=excluded.updated_by,updated_at=now();
  insert into public.account_admin_audit_events(actor_user_id,target_user_id,action,reason,metadata)
  values(v_actor,p_user_id,case when p_status='active' then 'moderation.clear' when p_status='suspended' then 'moderation.suspend' else 'moderation.ban' end,v_reason,jsonb_build_object('status',p_status,'expires_at',p_expires_at));
  return jsonb_build_object('ok',true,'user_id',p_user_id,'status',p_status,'expires_at',case when p_status='suspended' then p_expires_at else null end);
end;
$$;
revoke all on function public.admin_set_moderation(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.admin_set_moderation(uuid,text,text,timestamptz) to authenticated,service_role;

create or replace function public.admin_get_account_audit(p_user_id uuid,p_limit integer default 100)
returns table(id bigint,actor_user_id uuid,target_user_id uuid,action text,reason text,metadata jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not kelo_private.has_permission('audit.view') then raise exception 'ADMIN_PERMISSION_DENIED'; end if;
  return query select e.id,e.actor_user_id,e.target_user_id,e.action,e.reason,e.metadata,e.created_at
  from public.account_admin_audit_events e where e.target_user_id=p_user_id order by e.created_at desc limit greatest(1,least(coalesce(p_limit,100),250));
end;
$$;
revoke all on function public.admin_get_account_audit(uuid,integer) from public,anon;
grant execute on function public.admin_get_account_audit(uuid,integer) to authenticated,service_role;

alter table public.permission_definitions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.account_permissions enable row level security;
alter table public.account_moderation enable row level security;
alter table public.account_admin_audit_events enable row level security;

revoke all on public.permission_definitions,public.role_permissions,public.account_permissions,public.account_moderation,public.account_admin_audit_events from anon,authenticated;
grant select on public.permission_definitions,public.role_permissions to authenticated;
grant select on public.account_permissions,public.account_moderation to authenticated;

create policy permission_definitions_read_authenticated on public.permission_definitions for select to authenticated using(true);
create policy role_permissions_read_authenticated on public.role_permissions for select to authenticated using(true);
create policy account_permissions_read_own on public.account_permissions for select to authenticated using((select auth.uid()) is not null and user_id=(select auth.uid()));
create policy account_moderation_read_own on public.account_moderation for select to authenticated using((select auth.uid()) is not null and user_id=(select auth.uid()));
create policy account_admin_audit_deny on public.account_admin_audit_events for all to anon,authenticated using(false) with check(false);

-- Safe first-owner bootstrap: only when the project has exactly one permanent account and no admin yet.
do $$
declare v_uid uuid; v_count integer;
begin
  select count(*) into v_count from auth.users where coalesce(is_anonymous,false)=false;
  if v_count=1 and not exists(select 1 from public.account_roles where role_key='admin') then
    select id into v_uid from auth.users where coalesce(is_anonymous,false)=false limit 1;
    insert into public.account_roles(user_id,role_key,granted_by) values(v_uid,'admin',v_uid),(v_uid,'creator',v_uid) on conflict do nothing;
    insert into public.account_admin_audit_events(actor_user_id,target_user_id,action,metadata) values(v_uid,v_uid,'bootstrap.owner',jsonb_build_object('roles',jsonb_build_array('admin','creator')));
  end if;
end $$;

comment on table public.account_moderation is 'Account-level access state managed only through audited admin RPCs.';
comment on table public.account_permissions is 'Explicit permission overrides layered on top of role_permissions.';
comment on function public.get_my_account_access() is 'Authenticated self-service projection consumed by client and game server for roles, scopes and account restriction state.';

commit;
