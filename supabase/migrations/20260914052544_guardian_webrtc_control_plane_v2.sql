begin;

create table if not exists public.guardian_nodes (
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id text not null,
  capabilities jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  recommended_roles text[] not null default array[]::text[],
  role text not null default 'donor-ready' check (role in ('donor-ready','master-host')),
  enabled boolean not null default true,
  last_heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,node_id),
  constraint guardian_nodes_node_id_format check (node_id ~ '^[A-Za-z0-9:_-]{8,96}$')
);
create unique index if not exists guardian_nodes_node_id_uidx on public.guardian_nodes(node_id);
create index if not exists guardian_nodes_active_idx on public.guardian_nodes(last_heartbeat_at desc) where enabled=true;

create table if not exists public.guardian_master_lease (
  singleton smallint primary key default 1 check (singleton=1),
  user_id uuid references auth.users(id) on delete set null,
  node_id text,
  epoch bigint not null default 0,
  started_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.guardian_master_lease(singleton) values (1) on conflict (singleton) do nothing;

create table if not exists public.guardian_signals (
  id bigint generated always as identity primary key,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  from_node_id text not null,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  to_node_id text not null,
  kind text not null check (kind in ('offer','answer','ice','bye')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '30 seconds'),
  consumed_at timestamptz
);
create index if not exists guardian_signals_target_idx on public.guardian_signals(to_user_id,to_node_id,id) where consumed_at is null;
create index if not exists guardian_signals_expiry_idx on public.guardian_signals(expires_at);

alter table public.guardian_nodes enable row level security;
alter table public.guardian_master_lease enable row level security;
alter table public.guardian_signals enable row level security;
revoke all on public.guardian_nodes,public.guardian_master_lease,public.guardian_signals from anon,authenticated;

create or replace function kelo_private.guardian_recommended_roles(p_capabilities jsonb,p_preferences jsonb)
returns text[] language plpgsql immutable set search_path='' as $$
declare
  v_roles text[]:=array['witness-ready']::text[];
  v_cores numeric:=case when coalesce(p_capabilities->>'cores','') ~ '^[0-9]+(?:\.[0-9]+)?$' then (p_capabilities->>'cores')::numeric else 0 end;
begin
  if coalesce(p_preferences->>'allowAssets','true') <> 'false' then v_roles:=array_append(v_roles,'asset-seeder-ready'); end if;
  if coalesce(p_preferences->>'allowRelay','true') <> 'false' and coalesce(p_capabilities->>'webrtc','false')='true' then v_roles:=array_append(v_roles,'relay-ready'); end if;
  if coalesce(p_preferences->>'allowCompute','false')='true' and v_cores>=4 and coalesce(p_capabilities->>'visibility','unknown')='visible' then v_roles:=array_append(v_roles,'compute-candidate'); end if;
  return v_roles;
end;
$$;

create or replace function kelo_private.guardian_master_eligible(p_uid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.account_roles ar where ar.user_id=p_uid and ar.role_key='admin')
    or 'guardian.master_host'=any(kelo_private.permissions_for_user(p_uid))
    or 'guardian.master-host'=any(kelo_private.permissions_for_user(p_uid));
$$;

create or replace function kelo_private.guardian_cleanup()
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid;v_node text;
begin
  select l.user_id,l.node_id into v_uid,v_node
  from public.guardian_master_lease l
  where l.singleton=1 and l.user_id is not null and (
    l.expires_at is null or l.expires_at<=now() or not exists(
      select 1 from public.guardian_nodes n
      where n.user_id=l.user_id and n.node_id=l.node_id and n.enabled=true and n.last_heartbeat_at>now()-interval '45 seconds'
    )
  );
  if v_uid is not null then
    update public.guardian_nodes set role='donor-ready',updated_at=now() where user_id=v_uid and node_id=v_node;
    update public.guardian_master_lease set user_id=null,node_id=null,started_at=null,expires_at=null,updated_at=now() where singleton=1;
  end if;
  delete from public.guardian_signals where expires_at<=now() or (consumed_at is not null and consumed_at<now()-interval '60 seconds');
end;
$$;

create or replace function kelo_private.guardian_response(p_uid uuid,p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_node public.guardian_nodes%rowtype;
  v_lease public.guardian_master_lease%rowtype;
  v_active bigint:=0;v_ios bigint:=0;v_relay bigint:=0;v_assets bigint:=0;v_compute bigint:=0;
  v_node_json jsonb:=null;v_master jsonb:=null;
begin
  perform kelo_private.guardian_cleanup();
  select * into v_node from public.guardian_nodes n where n.user_id=p_uid and n.node_id=p_node_id and n.enabled=true and n.last_heartbeat_at>now()-interval '45 seconds';
  if found then
    v_node_json:=jsonb_build_object(
      'nodeId',v_node.node_id,'enabled',true,'role',v_node.role,'recommendedRoles',to_jsonb(v_node.recommended_roles),
      'capabilities',v_node.capabilities,'preferences',v_node.preferences,
      'lastHeartbeatAt',(extract(epoch from v_node.last_heartbeat_at)*1000)::bigint,
      'masterLeaseExpiresAt',case when v_node.role='master-host' then (select (extract(epoch from expires_at)*1000)::bigint from public.guardian_master_lease where singleton=1 and user_id=p_uid and node_id=p_node_id) else null end,
      'masterEpoch',case when v_node.role='master-host' then (select epoch from public.guardian_master_lease where singleton=1 and user_id=p_uid and node_id=p_node_id) else null end
    );
  end if;
  select * into v_lease from public.guardian_master_lease where singleton=1 and user_id is not null and expires_at>now();
  if found then v_master:=jsonb_build_object('nodeId',v_lease.node_id,'epoch',v_lease.epoch,'expiresAt',(extract(epoch from v_lease.expires_at)*1000)::bigint); end if;
  select count(*),count(*) filter(where capabilities->>'platform'='ios'),count(*) filter(where recommended_roles@>array['relay-ready']::text[]),count(*) filter(where recommended_roles@>array['asset-seeder-ready']::text[]),count(*) filter(where recommended_roles@>array['compute-candidate']::text[])
    into v_active,v_ios,v_relay,v_assets,v_compute
    from public.guardian_nodes where enabled=true and last_heartbeat_at>now()-interval '45 seconds';
  return jsonb_build_object(
    'ok',true,'source','guardian-supabase-v2','serverTime',(extract(epoch from now())*1000)::bigint,
    'masterEligible',kelo_private.guardian_master_eligible(p_uid),'node',v_node_json,'master',v_master,
    'network',jsonb_build_object('activeNodes',v_active,'iosNodes',v_ios,'relayReady',v_relay,'assetReady',v_assets,'computeReady',v_compute,'masterActive',v_master is not null,'masterEpoch',coalesce(v_lease.epoch,0),'masterNodeId',v_lease.node_id)
  );
end;
$$;

create or replace function public.guardian_enable(p_node_id text,p_capabilities jsonb default '{}'::jsonb,p_preferences jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_role text:='donor-ready';
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_node_id is null or p_node_id !~ '^[A-Za-z0-9:_-]{8,96}$' then raise exception 'GUARDIAN_NODE_ID_INVALID'; end if;
  perform kelo_private.guardian_cleanup();
  if exists(select 1 from public.guardian_master_lease where singleton=1 and user_id=v_uid and node_id=p_node_id and expires_at>now()) then v_role:='master-host'; end if;
  insert into public.guardian_nodes(user_id,node_id,capabilities,preferences,recommended_roles,role,enabled,last_heartbeat_at,updated_at)
  values(v_uid,p_node_id,coalesce(p_capabilities,'{}'::jsonb),coalesce(p_preferences,'{}'::jsonb),kelo_private.guardian_recommended_roles(coalesce(p_capabilities,'{}'::jsonb),coalesce(p_preferences,'{}'::jsonb)),v_role,true,now(),now())
  on conflict(user_id,node_id) do update set capabilities=excluded.capabilities,preferences=excluded.preferences,recommended_roles=excluded.recommended_roles,role=excluded.role,enabled=true,last_heartbeat_at=now(),updated_at=now();
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

create or replace function public.guardian_heartbeat(p_node_id text,p_capabilities jsonb default null,p_preferences jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_visibility text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform kelo_private.guardian_cleanup();
  if not exists(select 1 from public.guardian_nodes where user_id=v_uid and node_id=p_node_id and enabled=true) then raise exception 'GUARDIAN_NODE_NOT_ENABLED'; end if;
  update public.guardian_nodes set
    capabilities=coalesce(p_capabilities,capabilities),preferences=coalesce(p_preferences,preferences),
    recommended_roles=kelo_private.guardian_recommended_roles(coalesce(p_capabilities,capabilities),coalesce(p_preferences,preferences)),
    last_heartbeat_at=now(),updated_at=now()
    where user_id=v_uid and node_id=p_node_id;
  select capabilities->>'visibility' into v_visibility from public.guardian_nodes where user_id=v_uid and node_id=p_node_id;
  if exists(select 1 from public.guardian_master_lease where singleton=1 and user_id=v_uid and node_id=p_node_id and expires_at>now()) then
    if v_visibility='visible' then
      update public.guardian_master_lease set expires_at=now()+interval '25 seconds',updated_at=now() where singleton=1;
      update public.guardian_nodes set role='master-host' where user_id=v_uid and node_id=p_node_id;
    else
      update public.guardian_master_lease set user_id=null,node_id=null,started_at=null,expires_at=null,updated_at=now() where singleton=1;
      update public.guardian_nodes set role='donor-ready' where user_id=v_uid and node_id=p_node_id;
    end if;
  end if;
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

create or replace function public.guardian_disable(p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists(select 1 from public.guardian_master_lease where singleton=1 and user_id=v_uid and node_id=p_node_id) then
    update public.guardian_master_lease set user_id=null,node_id=null,started_at=null,expires_at=null,updated_at=now() where singleton=1;
  end if;
  delete from public.guardian_signals where (from_user_id=v_uid and from_node_id=p_node_id) or (to_user_id=v_uid and to_node_id=p_node_id);
  delete from public.guardian_nodes where user_id=v_uid and node_id=p_node_id;
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

create or replace function public.guardian_status(p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

create or replace function public.guardian_master_start(p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_lease public.guardian_master_lease%rowtype;v_visibility text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.guardian_master_eligible(v_uid) then raise exception 'GUARDIAN_MASTER_PERMISSION_DENIED'; end if;
  perform kelo_private.guardian_cleanup();
  select capabilities->>'visibility' into v_visibility from public.guardian_nodes where user_id=v_uid and node_id=p_node_id and enabled=true and last_heartbeat_at>now()-interval '45 seconds';
  if v_visibility is null then raise exception 'GUARDIAN_NODE_NOT_ENABLED'; end if;
  if v_visibility<>'visible' then raise exception 'GUARDIAN_FOREGROUND_REQUIRED'; end if;
  select * into v_lease from public.guardian_master_lease where singleton=1 for update;
  if v_lease.user_id is not null and v_lease.expires_at>now() and v_lease.user_id<>v_uid then raise exception 'GUARDIAN_MASTER_BUSY'; end if;
  if v_lease.user_id is not null and (v_lease.user_id<>v_uid or v_lease.node_id<>p_node_id) then update public.guardian_nodes set role='donor-ready',updated_at=now() where user_id=v_lease.user_id and node_id=v_lease.node_id; end if;
  update public.guardian_master_lease set user_id=v_uid,node_id=p_node_id,epoch=epoch+1,started_at=now(),expires_at=now()+interval '25 seconds',updated_at=now() where singleton=1;
  update public.guardian_nodes set role='master-host',last_heartbeat_at=now(),updated_at=now() where user_id=v_uid and node_id=p_node_id;
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

create or replace function public.guardian_master_stop(p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.guardian_master_eligible(v_uid) then raise exception 'GUARDIAN_MASTER_PERMISSION_DENIED'; end if;
  if exists(select 1 from public.guardian_master_lease where singleton=1 and user_id=v_uid and node_id=p_node_id) then update public.guardian_master_lease set user_id=null,node_id=null,started_at=null,expires_at=null,updated_at=now() where singleton=1; end if;
  update public.guardian_nodes set role='donor-ready',updated_at=now() where user_id=v_uid and node_id=p_node_id;
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

create or replace function public.guardian_signal_send(p_node_id text,p_to_node_id text,p_kind text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_target_uid uuid;v_lease public.guardian_master_lease%rowtype;v_id bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform kelo_private.guardian_cleanup();
  if not exists(select 1 from public.guardian_nodes where user_id=v_uid and node_id=p_node_id and enabled=true and last_heartbeat_at>now()-interval '45 seconds') then raise exception 'GUARDIAN_NODE_NOT_ENABLED'; end if;
  select user_id into v_target_uid from public.guardian_nodes where node_id=p_to_node_id and enabled=true and last_heartbeat_at>now()-interval '45 seconds';
  if v_target_uid is null then raise exception 'GUARDIAN_SIGNAL_TARGET_UNAVAILABLE'; end if;
  if p_kind not in ('offer','answer','ice','bye') then raise exception 'GUARDIAN_SIGNAL_KIND_INVALID'; end if;
  if octet_length(coalesce(p_payload,'{}'::jsonb)::text)>32768 then raise exception 'GUARDIAN_SIGNAL_TOO_LARGE'; end if;
  select * into v_lease from public.guardian_master_lease where singleton=1 and user_id is not null and expires_at>now();
  if v_lease.user_id is null or not ((v_lease.user_id=v_uid and v_lease.node_id=p_node_id) or (v_lease.user_id=v_target_uid and v_lease.node_id=p_to_node_id)) then raise exception 'GUARDIAN_SIGNAL_PAIR_DENIED'; end if;
  insert into public.guardian_signals(from_user_id,from_node_id,to_user_id,to_node_id,kind,payload) values(v_uid,p_node_id,v_target_uid,p_to_node_id,p_kind,coalesce(p_payload,'{}'::jsonb)) returning id into v_id;
  return jsonb_build_object('ok',true,'source','guardian-supabase-v2','signalId',v_id);
end;
$$;

create or replace function public.guardian_signal_poll(p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_signals jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform kelo_private.guardian_cleanup();
  if not exists(select 1 from public.guardian_nodes where user_id=v_uid and node_id=p_node_id and enabled=true and last_heartbeat_at>now()-interval '45 seconds') then raise exception 'GUARDIAN_NODE_NOT_ENABLED'; end if;
  with picked as (
    select id from public.guardian_signals where to_user_id=v_uid and to_node_id=p_node_id and consumed_at is null and expires_at>now() order by id limit 32 for update skip locked
  ), consumed as (
    update public.guardian_signals s set consumed_at=now() from picked p where s.id=p.id returning s.id,s.from_node_id,s.kind,s.payload,s.created_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'fromNodeId',from_node_id,'type',kind,'data',payload,'createdAt',(extract(epoch from created_at)*1000)::bigint) order by id),'[]'::jsonb) into v_signals from consumed;
  return jsonb_build_object('ok',true,'source','guardian-supabase-v2','signals',v_signals);
end;
$$;

revoke all on function public.guardian_enable(text,jsonb,jsonb) from public,anon;
revoke all on function public.guardian_heartbeat(text,jsonb,jsonb) from public,anon;
revoke all on function public.guardian_disable(text) from public,anon;
revoke all on function public.guardian_status(text) from public,anon;
revoke all on function public.guardian_master_start(text) from public,anon;
revoke all on function public.guardian_master_stop(text) from public,anon;
revoke all on function public.guardian_signal_send(text,text,text,jsonb) from public,anon;
revoke all on function public.guardian_signal_poll(text) from public,anon;
grant execute on function public.guardian_enable(text,jsonb,jsonb) to authenticated,service_role;
grant execute on function public.guardian_heartbeat(text,jsonb,jsonb) to authenticated,service_role;
grant execute on function public.guardian_disable(text) to authenticated,service_role;
grant execute on function public.guardian_status(text) to authenticated,service_role;
grant execute on function public.guardian_master_start(text) to authenticated,service_role;
grant execute on function public.guardian_master_stop(text) to authenticated,service_role;
grant execute on function public.guardian_signal_send(text,text,text,jsonb) to authenticated,service_role;
grant execute on function public.guardian_signal_poll(text) to authenticated,service_role;

commit;
