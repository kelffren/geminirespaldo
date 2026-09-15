begin;

create table if not exists public.content_definitions (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type ~ '^[a-z][a-z0-9._-]{1,63}$'),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  display_name text not null check (char_length(display_name) between 1 and 100),
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, content_type, slug)
);
create index if not exists content_definitions_owner_idx on public.content_definitions(owner_user_id, created_at desc);
create index if not exists content_definitions_type_idx on public.content_definitions(content_type, created_at desc);
create index if not exists content_definitions_tags_gin_idx on public.content_definitions using gin(tags);

create table if not exists public.content_definition_revisions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.content_definitions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null check (revision > 0),
  content_id text not null unique,
  schema_version integer not null default 1 check (schema_version > 0),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{32,128}$'),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(definition_id, revision),
  unique(definition_id, content_hash)
);
create index if not exists content_revisions_definition_idx on public.content_definition_revisions(definition_id, revision desc);
create index if not exists content_revisions_owner_idx on public.content_definition_revisions(owner_user_id, created_at desc);
create index if not exists content_revisions_hash_idx on public.content_definition_revisions(content_hash);

create table if not exists public.content_asset_bindings (
  content_revision_id uuid not null references public.content_definition_revisions(id) on delete cascade,
  asset_revision_id uuid not null references public.asset_revisions(id) on delete restrict,
  role text not null check (role ~ '^[a-z][a-z0-9._-]{0,63}$'),
  ordinal integer not null default 0 check (ordinal >= 0),
  metadata jsonb not null default '{}'::jsonb,
  primary key(content_revision_id, role, ordinal)
);
create index if not exists content_asset_bindings_asset_idx on public.content_asset_bindings(asset_revision_id);

create table if not exists public.content_review_requests (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null unique references public.content_definition_revisions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  note text
);
create index if not exists content_review_status_idx on public.content_review_requests(status, submitted_at);
create index if not exists content_review_owner_idx on public.content_review_requests(owner_user_id, submitted_at desc);

create table if not exists public.content_publications (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null unique references public.content_definition_revisions(id) on delete restrict,
  visibility text not null check (visibility in ('global','official')),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  is_active boolean not null default true
);
create index if not exists content_publications_active_idx on public.content_publications(is_active, published_at desc);

create or replace function public.create_content_definition(
  p_content_type text,
  p_slug text,
  p_display_name text,
  p_tags text[] default '{}',
  p_metadata jsonb default '{}'::jsonb
)
returns public.content_definitions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_type text := lower(trim(p_content_type));
  v_slug text := lower(trim(p_slug));
  v_row public.content_definitions;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_type !~ '^[a-z][a-z0-9._-]{1,63}$' then raise exception 'INVALID_CONTENT_TYPE'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9_-]{1,62}$' then raise exception 'INVALID_CONTENT_SLUG'; end if;
  if p_display_name is null or char_length(trim(p_display_name)) < 1 or char_length(trim(p_display_name)) > 100 then raise exception 'INVALID_CONTENT_NAME'; end if;
  insert into public.content_definitions(stable_key, owner_user_id, content_type, slug, display_name, tags, metadata)
  values ('content:' || v_uid::text || ':' || v_type || ':' || v_slug, v_uid, v_type, v_slug, trim(p_display_name), coalesce(p_tags,'{}'), coalesce(p_metadata,'{}'::jsonb))
  on conflict (owner_user_id, content_type, slug) do update set
    display_name = excluded.display_name,
    tags = excluded.tags,
    metadata = public.content_definitions.metadata || excluded.metadata,
    updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.create_content_definition(text,text,text,text[],jsonb) from public, anon;
grant execute on function public.create_content_definition(text,text,text,text[],jsonb) to authenticated, service_role;

create or replace function public.register_content_revision(
  p_definition_id uuid,
  p_content_hash text,
  p_schema_version integer default 1,
  p_payload jsonb default '{}'::jsonb,
  p_asset_bindings jsonb default '[]'::jsonb
)
returns public.content_definition_revisions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_definition public.content_definitions;
  v_hash text := lower(trim(p_content_hash));
  v_revision integer;
  v_row public.content_definition_revisions;
  v_binding jsonb;
  v_asset_id uuid;
  v_role text;
  v_ordinal integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_definition from public.content_definitions where id = p_definition_id and owner_user_id = v_uid for update;
  if v_definition.id is null then raise exception 'CONTENT_DEFINITION_NOT_FOUND'; end if;
  if v_hash !~ '^[0-9a-f]{32,128}$' then raise exception 'INVALID_CONTENT_HASH'; end if;
  if coalesce(p_schema_version,0) < 1 then raise exception 'INVALID_SCHEMA_VERSION'; end if;
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object' then raise exception 'CONTENT_PAYLOAD_MUST_BE_OBJECT'; end if;
  if jsonb_typeof(coalesce(p_asset_bindings,'[]'::jsonb)) <> 'array' then raise exception 'ASSET_BINDINGS_MUST_BE_ARRAY'; end if;

  select * into v_row from public.content_definition_revisions where definition_id = p_definition_id and content_hash = v_hash;
  if v_row.id is not null then return v_row; end if;

  select coalesce(max(revision),0)+1 into v_revision from public.content_definition_revisions where definition_id = p_definition_id;
  insert into public.content_definition_revisions(definition_id, owner_user_id, revision, content_id, schema_version, content_hash, payload)
  values (p_definition_id, v_uid, v_revision, v_definition.stable_key || '@r' || v_revision::text || '-' || left(v_hash,12), coalesce(p_schema_version,1), v_hash, coalesce(p_payload,'{}'::jsonb))
  returning * into v_row;

  for v_binding in select value from jsonb_array_elements(coalesce(p_asset_bindings,'[]'::jsonb)) loop
    begin v_asset_id := (v_binding->>'assetRevisionId')::uuid; exception when others then raise exception 'INVALID_ASSET_BINDING_ID'; end;
    v_role := lower(trim(coalesce(v_binding->>'role','')));
    v_ordinal := greatest(0,coalesce((v_binding->>'ordinal')::integer,0));
    if v_role !~ '^[a-z][a-z0-9._-]{0,63}$' then raise exception 'INVALID_ASSET_BINDING_ROLE'; end if;
    if not exists(
      select 1 from public.asset_revisions ar
      where ar.id = v_asset_id and (
        ar.owner_user_id = v_uid or exists(select 1 from public.asset_publications ap where ap.revision_id = ar.id and ap.is_active = true)
      )
    ) then raise exception 'ASSET_BINDING_NOT_VISIBLE'; end if;
    insert into public.content_asset_bindings(content_revision_id,asset_revision_id,role,ordinal,metadata)
    values(v_row.id,v_asset_id,v_role,v_ordinal,coalesce(v_binding->'metadata','{}'::jsonb));
  end loop;
  return v_row;
end;
$$;
revoke all on function public.register_content_revision(uuid,text,integer,jsonb,jsonb) from public, anon;
grant execute on function public.register_content_revision(uuid,text,integer,jsonb,jsonb) to authenticated, service_role;

create or replace function public.submit_content_revision(p_revision_id uuid)
returns public.content_review_requests
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_row public.content_review_requests;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.content_definition_revisions where id=p_revision_id and owner_user_id=v_uid) then raise exception 'CONTENT_REVISION_NOT_FOUND'; end if;
  insert into public.content_review_requests(revision_id,owner_user_id)
  values(p_revision_id,v_uid)
  on conflict(revision_id) do update set
    status=case when public.content_review_requests.status in ('cancelled','rejected') then 'pending' else public.content_review_requests.status end,
    submitted_at=case when public.content_review_requests.status in ('cancelled','rejected') then now() else public.content_review_requests.submitted_at end,
    decided_at=case when public.content_review_requests.status in ('cancelled','rejected') then null else public.content_review_requests.decided_at end,
    decided_by=case when public.content_review_requests.status in ('cancelled','rejected') then null else public.content_review_requests.decided_by end
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.submit_content_revision(uuid) from public, anon;
grant execute on function public.submit_content_revision(uuid) to authenticated, service_role;

create or replace function public.publish_content_revision(
  p_revision_id uuid,
  p_visibility text default 'global',
  p_published_by uuid default null
)
returns public.content_publications
language plpgsql security definer set search_path = '' as $$
declare v_row public.content_publications;
begin
  if p_visibility not in ('global','official') then raise exception 'INVALID_VISIBILITY'; end if;
  if not exists(select 1 from public.content_definition_revisions where id=p_revision_id) then raise exception 'CONTENT_REVISION_NOT_FOUND'; end if;
  insert into public.content_publications(revision_id,visibility,published_by)
  values(p_revision_id,p_visibility,p_published_by)
  on conflict(revision_id) do update set visibility=excluded.visibility,published_by=excluded.published_by,published_at=now(),is_active=true
  returning * into v_row;
  update public.content_review_requests set status='approved',decided_at=now(),decided_by=p_published_by where revision_id=p_revision_id;
  return v_row;
end;
$$;
revoke all on function public.publish_content_revision(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.publish_content_revision(uuid,text,uuid) to service_role;

create or replace function kelo_private.broadcast_content_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_content_id text; v_type text;
begin
  select r.content_id,d.content_type into v_content_id,v_type
  from public.content_definition_revisions r join public.content_definitions d on d.id=r.definition_id
  where r.id=new.revision_id;
  perform realtime.send(
    jsonb_build_object('publicationId',new.id,'revisionId',new.revision_id,'contentId',v_content_id,'contentType',v_type,'visibility',new.visibility,'publishedAt',new.published_at),
    'content_published','content:global:published',false
  );
  return null;
end;
$$;

create trigger content_definitions_touch_updated_at before update on public.content_definitions for each row execute function kelo_private.touch_updated_at();
create trigger content_publication_broadcast after insert or update of is_active,visibility on public.content_publications
for each row when (new.is_active=true) execute function kelo_private.broadcast_content_publication();

alter table public.content_definitions enable row level security;
alter table public.content_definition_revisions enable row level security;
alter table public.content_asset_bindings enable row level security;
alter table public.content_review_requests enable row level security;
alter table public.content_publications enable row level security;

revoke all on public.content_definitions, public.content_definition_revisions, public.content_asset_bindings, public.content_review_requests, public.content_publications from anon, authenticated;
grant select on public.content_definitions, public.content_definition_revisions, public.content_asset_bindings, public.content_publications to anon, authenticated;
grant select on public.content_review_requests to authenticated;
grant update(display_name,tags,metadata) on public.content_definitions to authenticated;

create policy content_publications_public_read on public.content_publications for select to anon,authenticated using(is_active=true);
create policy content_definitions_visible_read on public.content_definitions for select to anon,authenticated using(
  owner_user_id=(select auth.uid()) or exists(
    select 1 from public.content_definition_revisions r join public.content_publications p on p.revision_id=r.id
    where r.definition_id=content_definitions.id and p.is_active=true
  )
);
create policy content_definitions_owner_update on public.content_definitions for update to authenticated
using((select auth.uid()) is not null and owner_user_id=(select auth.uid())) with check(owner_user_id=(select auth.uid()));
create policy content_revisions_visible_read on public.content_definition_revisions for select to anon,authenticated using(
  owner_user_id=(select auth.uid()) or exists(select 1 from public.content_publications p where p.revision_id=content_definition_revisions.id and p.is_active=true)
);
create policy content_bindings_visible_read on public.content_asset_bindings for select to anon,authenticated using(
  exists(
    select 1 from public.content_definition_revisions r
    where r.id=content_asset_bindings.content_revision_id and (
      r.owner_user_id=(select auth.uid()) or exists(select 1 from public.content_publications p where p.revision_id=r.id and p.is_active=true)
    )
  )
);
create policy content_reviews_owner_read on public.content_review_requests for select to authenticated
using((select auth.uid()) is not null and owner_user_id=(select auth.uid()));

comment on table public.content_definitions is 'Stable semantic identity for creator-authored world, appearance, equipment, character, mount, VFX and future content types.';
comment on table public.content_definition_revisions is 'Immutable versioned content payloads. Runtime systems consume semantic definitions rather than spreadsheet rows.';
comment on table public.content_asset_bindings is 'Many-to-many role bindings from one immutable content revision to immutable asset revisions.';
comment on table public.content_publications is 'Authority-approved public content revisions; creator-owned drafts remain immediately usable by their owner.';

commit;
