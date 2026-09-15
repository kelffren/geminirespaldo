begin;

create table if not exists public.maps (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maps_slug_format check (slug ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  constraint maps_name_length check (char_length(name) between 1 and 100),
  unique(owner_user_id, slug)
);
create index if not exists maps_owner_idx on public.maps(owner_user_id, updated_at desc);

create table if not exists public.map_versions (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  schema_version integer not null default 1 check (schema_version > 0),
  content_hash text not null,
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(map_id, version),
  unique(map_id, content_hash)
);
create index if not exists map_versions_map_idx on public.map_versions(map_id, version desc);
create index if not exists map_versions_author_idx on public.map_versions(author_user_id, created_at desc);

create table if not exists public.map_version_chunks (
  version_id uuid not null references public.map_versions(id) on delete cascade,
  chunk_key text not null,
  payload jsonb not null,
  byte_hint integer check (byte_hint is null or byte_hint >= 0),
  created_at timestamptz not null default now(),
  primary key(version_id, chunk_key),
  constraint map_chunk_key_length check (char_length(chunk_key) between 1 and 120)
);
create index if not exists map_chunks_version_idx on public.map_version_chunks(version_id);

create table if not exists public.map_asset_refs (
  version_id uuid not null references public.map_versions(id) on delete cascade,
  asset_revision_id uuid not null references public.asset_revisions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(version_id, asset_revision_id)
);
create index if not exists map_asset_refs_asset_idx on public.map_asset_refs(asset_revision_id, version_id);

create table if not exists public.map_publications (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete restrict,
  version_id uuid not null unique references public.map_versions(id) on delete restrict,
  visibility text not null check (visibility in ('unlisted','global','official')),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique(map_id, version_id)
);
create index if not exists map_publications_active_idx on public.map_publications(is_active, visibility, published_at desc);

create or replace function public.create_map(p_slug text, p_name text, p_description text default null)
returns public.maps language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_slug text := lower(trim(p_slug)); v_row public.maps;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9_-]{1,62}$' then raise exception 'INVALID_MAP_SLUG'; end if;
  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 100 then raise exception 'INVALID_MAP_NAME'; end if;
  insert into public.maps(stable_key, owner_user_id, slug, name, description)
  values ('creator:' || v_uid::text || ':map:' || v_slug, v_uid, v_slug, trim(p_name), nullif(trim(coalesce(p_description,'')),''))
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.create_map(text,text,text) from public, anon;
grant execute on function public.create_map(text,text,text) to authenticated, service_role;

create or replace function public.register_map_version(
  p_map_id uuid, p_content_hash text, p_schema_version integer default 1,
  p_manifest jsonb default '{}'::jsonb, p_chunks jsonb default '{}'::jsonb, p_asset_ids text[] default '{}'
)
returns public.map_versions language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_map public.maps; v_version integer;
  v_hash text := lower(trim(p_content_hash)); v_row public.map_versions; v_pair record;
  v_asset_id text; v_asset_revision uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_map from public.maps where id=p_map_id and owner_user_id=v_uid for update;
  if v_map.id is null then raise exception 'MAP_NOT_FOUND'; end if;
  if v_hash !~ '^[0-9a-f]{32,128}$' then raise exception 'INVALID_CONTENT_HASH'; end if;
  if p_schema_version is null or p_schema_version < 1 then raise exception 'INVALID_SCHEMA_VERSION'; end if;
  if jsonb_typeof(coalesce(p_chunks,'{}'::jsonb)) <> 'object' then raise exception 'CHUNKS_MUST_BE_OBJECT'; end if;

  select * into v_row from public.map_versions where map_id=p_map_id and content_hash=v_hash;
  if v_row.id is not null then return v_row; end if;

  select coalesce(max(version),0)+1 into v_version from public.map_versions where map_id=p_map_id;
  insert into public.map_versions(map_id,author_user_id,version,schema_version,content_hash,manifest)
  values(p_map_id,v_uid,v_version,p_schema_version,v_hash,coalesce(p_manifest,'{}'::jsonb)) returning * into v_row;

  for v_pair in select key,value from jsonb_each(coalesce(p_chunks,'{}'::jsonb)) loop
    insert into public.map_version_chunks(version_id,chunk_key,payload,byte_hint)
    values(v_row.id,v_pair.key,v_pair.value,octet_length(v_pair.value::text));
  end loop;

  foreach v_asset_id in array coalesce(p_asset_ids,'{}') loop
    select r.id into v_asset_revision
    from public.asset_revisions r
    where r.asset_id=v_asset_id and (
      r.owner_user_id=v_uid or exists(select 1 from public.asset_publications ap where ap.revision_id=r.id and ap.is_active=true)
    );
    if v_asset_revision is null then raise exception 'ASSET_NOT_ACCESSIBLE:%', v_asset_id; end if;
    insert into public.map_asset_refs(version_id,asset_revision_id) values(v_row.id,v_asset_revision) on conflict do nothing;
    v_asset_revision := null;
  end loop;
  return v_row;
end;
$$;
revoke all on function public.register_map_version(uuid,text,integer,jsonb,jsonb,text[]) from public, anon;
grant execute on function public.register_map_version(uuid,text,integer,jsonb,jsonb,text[]) to authenticated, service_role;

create or replace function public.publish_map_version(p_version_id uuid, p_visibility text default 'global', p_published_by uuid default null)
returns public.map_publications language plpgsql security definer set search_path = '' as $$
declare v_map_id uuid; v_row public.map_publications;
begin
  if p_visibility not in ('unlisted','global','official') then raise exception 'INVALID_VISIBILITY'; end if;
  select map_id into v_map_id from public.map_versions where id=p_version_id;
  if v_map_id is null then raise exception 'MAP_VERSION_NOT_FOUND'; end if;
  insert into public.map_publications(map_id,version_id,visibility,published_by)
  values(v_map_id,p_version_id,p_visibility,p_published_by)
  on conflict(version_id) do update set visibility=excluded.visibility,published_by=excluded.published_by,published_at=now(),is_active=true
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.publish_map_version(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.publish_map_version(uuid,text,uuid) to service_role;

create or replace function kelo_private.broadcast_map_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_stable_key text;
begin
  select m.stable_key into v_stable_key from public.maps m where m.id=new.map_id;
  perform realtime.send(
    jsonb_build_object('publicationId',new.id,'mapId',new.map_id,'versionId',new.version_id,'stableKey',v_stable_key,'visibility',new.visibility,'publishedAt',new.published_at),
    'map_published', 'maps:global:published', false
  );
  return null;
end;
$$;

create trigger maps_touch_updated_at before update on public.maps for each row execute function kelo_private.touch_updated_at();
create trigger map_publication_broadcast after insert or update of is_active, visibility on public.map_publications
for each row when (new.is_active=true) execute function kelo_private.broadcast_map_publication();

alter table public.maps enable row level security;
alter table public.map_versions enable row level security;
alter table public.map_version_chunks enable row level security;
alter table public.map_asset_refs enable row level security;
alter table public.map_publications enable row level security;

revoke all on public.maps, public.map_versions, public.map_version_chunks, public.map_asset_refs, public.map_publications from anon, authenticated;
grant select on public.maps, public.map_versions, public.map_version_chunks, public.map_asset_refs, public.map_publications to anon, authenticated;
grant update(name,description) on public.maps to authenticated;

create policy map_publications_public_read on public.map_publications for select to anon, authenticated using (is_active=true);
create policy maps_visible_read on public.maps for select to anon, authenticated using (
  owner_user_id=(select auth.uid()) or exists(select 1 from public.map_publications p where p.map_id=maps.id and p.is_active=true)
);
create policy maps_owner_update on public.maps for update to authenticated
using ((select auth.uid()) is not null and owner_user_id=(select auth.uid())) with check (owner_user_id=(select auth.uid()));
create policy map_versions_visible_read on public.map_versions for select to anon, authenticated using (
  author_user_id=(select auth.uid()) or exists(select 1 from public.map_publications p where p.version_id=map_versions.id and p.is_active=true)
);
create policy map_chunks_visible_read on public.map_version_chunks for select to anon, authenticated using (
  exists(select 1 from public.map_versions v where v.id=map_version_chunks.version_id and (
    v.author_user_id=(select auth.uid()) or exists(select 1 from public.map_publications p where p.version_id=v.id and p.is_active=true)
  ))
);
create policy map_asset_refs_visible_read on public.map_asset_refs for select to anon, authenticated using (
  exists(select 1 from public.map_versions v where v.id=map_asset_refs.version_id and (
    v.author_user_id=(select auth.uid()) or exists(select 1 from public.map_publications p where p.version_id=v.id and p.is_active=true)
  ))
);

create policy map_previews_insert_own on storage.objects for insert to authenticated
with check (bucket_id='map-previews' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy map_previews_update_own on storage.objects for update to authenticated
using (bucket_id='map-previews' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='map-previews' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy map_previews_delete_own on storage.objects for delete to authenticated
using (bucket_id='map-previews' and (storage.foldername(name))[1]=(select auth.uid())::text);

comment on table public.map_versions is 'Immutable map version header. Large map payloads are split into map_version_chunks.';
comment on table public.map_asset_refs is 'Exact immutable asset revision dependencies for each map version.';

commit;
