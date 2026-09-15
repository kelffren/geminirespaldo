begin;

create table if not exists public.asset_families (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  kind text not null default 'prop' check (kind in ('prop','tile','character','mount','item','vfx','ui','audio','other')),
  category text,
  semantic_family text,
  tags text[] not null default '{}',
  districts text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_family_slug_format check (slug ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  constraint asset_family_name_length check (char_length(name) between 1 and 80),
  unique(owner_user_id, slug)
);
create index if not exists asset_families_owner_idx on public.asset_families(owner_user_id, created_at desc);
create index if not exists asset_families_semantic_idx on public.asset_families(semantic_family) where semantic_family is not null;
create index if not exists asset_families_tags_gin_idx on public.asset_families using gin(tags);

create table if not exists public.asset_revisions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.asset_families(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null check (revision > 0),
  asset_id text not null unique,
  content_hash text not null,
  storage_bucket text not null default 'creator-private' check (storage_bucket = 'creator-private'),
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/png','image/webp','image/jpeg')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 5242880),
  pixel_width integer not null check (pixel_width between 1 and 2048),
  pixel_height integer not null check (pixel_height between 1 and 2048),
  world_width numeric(10,2) check (world_width is null or world_width > 0),
  world_height numeric(10,2) check (world_height is null or world_height > 0),
  collision_mode text not null default 'none' check (collision_mode in ('none','full','trunk','custom')),
  render_phase text not null default 'world' check (render_phase in ('ground','belowActor','world','aboveActor','foreground')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(family_id, revision),
  unique(family_id, content_hash),
  unique(storage_bucket, storage_path)
);
create index if not exists asset_revisions_family_idx on public.asset_revisions(family_id, revision desc);
create index if not exists asset_revisions_owner_idx on public.asset_revisions(owner_user_id, created_at desc);
create index if not exists asset_revisions_hash_idx on public.asset_revisions(content_hash);

create table if not exists public.asset_review_requests (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.asset_revisions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  note text,
  unique(revision_id)
);
create index if not exists asset_review_status_idx on public.asset_review_requests(status, submitted_at);
create index if not exists asset_review_owner_idx on public.asset_review_requests(owner_user_id, submitted_at desc);

create table if not exists public.asset_publications (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null unique references public.asset_revisions(id) on delete restrict,
  visibility text not null check (visibility in ('global','official')),
  public_storage_bucket text not null default 'creator-global' check (public_storage_bucket = 'creator-global'),
  public_storage_path text not null unique,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  is_active boolean not null default true
);
create index if not exists asset_publications_active_idx on public.asset_publications(is_active, published_at desc);

create or replace function public.create_asset_family(
  p_slug text,
  p_name text,
  p_kind text default 'prop',
  p_category text default null,
  p_semantic_family text default null,
  p_tags text[] default '{}',
  p_districts text[] default '{}',
  p_metadata jsonb default '{}'::jsonb
)
returns public.asset_families language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_slug text := lower(trim(p_slug)); v_row public.asset_families;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9_-]{1,62}$' then raise exception 'INVALID_ASSET_SLUG'; end if;
  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 80 then raise exception 'INVALID_ASSET_NAME'; end if;
  insert into public.asset_families(stable_key, owner_user_id, slug, name, kind, category, semantic_family, tags, districts, metadata)
  values ('creator:' || v_uid::text || ':' || v_slug, v_uid, v_slug, trim(p_name), coalesce(p_kind,'prop'), nullif(trim(coalesce(p_category,'')),''), nullif(trim(coalesce(p_semantic_family,'')),''), coalesce(p_tags,'{}'), coalesce(p_districts,'{}'), coalesce(p_metadata,'{}'::jsonb))
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.create_asset_family(text,text,text,text,text,text[],text[],jsonb) from public, anon;
grant execute on function public.create_asset_family(text,text,text,text,text,text[],text[],jsonb) to authenticated, service_role;

create or replace function public.register_asset_revision(
  p_family_id uuid, p_storage_path text, p_content_hash text, p_mime_type text,
  p_byte_size bigint, p_pixel_width integer, p_pixel_height integer,
  p_world_width numeric default null, p_world_height numeric default null,
  p_collision_mode text default 'none', p_render_phase text default 'world', p_metadata jsonb default '{}'::jsonb
)
returns public.asset_revisions language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_family public.asset_families; v_revision integer;
  v_hash text := lower(trim(p_content_hash)); v_row public.asset_revisions;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_family from public.asset_families where id = p_family_id and owner_user_id = v_uid for update;
  if v_family.id is null then raise exception 'ASSET_FAMILY_NOT_FOUND'; end if;
  if p_storage_path is null or split_part(p_storage_path,'/',1) <> v_uid::text then raise exception 'INVALID_STORAGE_PATH'; end if;
  if v_hash !~ '^[0-9a-f]{32,128}$' then raise exception 'INVALID_CONTENT_HASH'; end if;
  if p_mime_type not in ('image/png','image/webp','image/jpeg') then raise exception 'INVALID_MIME_TYPE'; end if;
  if p_byte_size <= 0 or p_byte_size > 5242880 then raise exception 'INVALID_FILE_SIZE'; end if;
  if p_pixel_width < 1 or p_pixel_width > 2048 or p_pixel_height < 1 or p_pixel_height > 2048 then raise exception 'INVALID_IMAGE_DIMENSIONS'; end if;

  select * into v_row from public.asset_revisions where family_id = p_family_id and content_hash = v_hash;
  if v_row.id is not null then return v_row; end if;

  select coalesce(max(revision),0)+1 into v_revision from public.asset_revisions where family_id = p_family_id;
  insert into public.asset_revisions(
    family_id, owner_user_id, revision, asset_id, content_hash, storage_path, mime_type, byte_size,
    pixel_width, pixel_height, world_width, world_height, collision_mode, render_phase, metadata
  ) values (
    p_family_id, v_uid, v_revision, v_family.stable_key || '@r' || v_revision::text || '-' || left(v_hash,12), v_hash,
    p_storage_path, p_mime_type, p_byte_size, p_pixel_width, p_pixel_height, p_world_width, p_world_height,
    coalesce(p_collision_mode,'none'), coalesce(p_render_phase,'world'), coalesce(p_metadata,'{}'::jsonb)
  ) returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.register_asset_revision(uuid,text,text,text,bigint,integer,integer,numeric,numeric,text,text,jsonb) from public, anon;
grant execute on function public.register_asset_revision(uuid,text,text,text,bigint,integer,integer,numeric,numeric,text,text,jsonb) to authenticated, service_role;

create or replace function public.submit_asset_revision(p_revision_id uuid)
returns public.asset_review_requests language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_row public.asset_review_requests;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.asset_revisions where id = p_revision_id and owner_user_id = v_uid) then raise exception 'ASSET_REVISION_NOT_FOUND'; end if;
  insert into public.asset_review_requests(revision_id, owner_user_id)
  values (p_revision_id, v_uid)
  on conflict (revision_id) do update set
    status = case when public.asset_review_requests.status = 'cancelled' then 'pending' else public.asset_review_requests.status end,
    submitted_at = case when public.asset_review_requests.status = 'cancelled' then now() else public.asset_review_requests.submitted_at end
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.submit_asset_revision(uuid) from public, anon;
grant execute on function public.submit_asset_revision(uuid) to authenticated, service_role;

create or replace function public.publish_asset_revision(
  p_revision_id uuid, p_public_storage_path text, p_visibility text default 'global', p_published_by uuid default null
)
returns public.asset_publications language plpgsql security definer set search_path = '' as $$
declare v_row public.asset_publications;
begin
  if p_visibility not in ('global','official') then raise exception 'INVALID_VISIBILITY'; end if;
  if p_public_storage_path is null or char_length(trim(p_public_storage_path)) < 3 then raise exception 'INVALID_PUBLIC_STORAGE_PATH'; end if;
  if not exists(select 1 from public.asset_revisions where id = p_revision_id) then raise exception 'ASSET_REVISION_NOT_FOUND'; end if;
  insert into public.asset_publications(revision_id, visibility, public_storage_path, published_by)
  values (p_revision_id, p_visibility, trim(p_public_storage_path), p_published_by)
  on conflict (revision_id) do update set visibility = excluded.visibility, public_storage_path = excluded.public_storage_path,
    published_by = excluded.published_by, published_at = now(), is_active = true
  returning * into v_row;
  update public.asset_review_requests set status='approved', decided_at=now(), decided_by=p_published_by where revision_id=p_revision_id;
  return v_row;
end;
$$;
revoke all on function public.publish_asset_revision(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.publish_asset_revision(uuid,text,text,uuid) to service_role;

create or replace function kelo_private.broadcast_asset_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_asset_id text;
begin
  select r.asset_id into v_asset_id from public.asset_revisions r where r.id = new.revision_id;
  perform realtime.send(
    jsonb_build_object('publicationId',new.id,'revisionId',new.revision_id,'assetId',v_asset_id,'visibility',new.visibility,'publishedAt',new.published_at),
    'asset_published', 'assets:global:published', false
  );
  return null;
end;
$$;

create trigger asset_families_touch_updated_at before update on public.asset_families for each row execute function kelo_private.touch_updated_at();
create trigger asset_publication_broadcast after insert or update of is_active, visibility, public_storage_path on public.asset_publications
for each row when (new.is_active = true) execute function kelo_private.broadcast_asset_publication();

alter table public.asset_families enable row level security;
alter table public.asset_revisions enable row level security;
alter table public.asset_review_requests enable row level security;
alter table public.asset_publications enable row level security;

revoke all on public.asset_families, public.asset_revisions, public.asset_review_requests, public.asset_publications from anon, authenticated;
grant select on public.asset_families, public.asset_revisions, public.asset_publications to anon, authenticated;
grant select on public.asset_review_requests to authenticated;
grant update(name, category, semantic_family, tags, districts, metadata) on public.asset_families to authenticated;

create policy asset_publications_public_read on public.asset_publications for select to anon, authenticated using (is_active = true);
create policy asset_families_visible_read on public.asset_families for select to anon, authenticated using (
  owner_user_id = (select auth.uid()) or exists (
    select 1 from public.asset_revisions r join public.asset_publications p on p.revision_id = r.id
    where r.family_id = asset_families.id and p.is_active = true
  )
);
create policy asset_families_owner_update on public.asset_families for update to authenticated
using ((select auth.uid()) is not null and owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy asset_revisions_visible_read on public.asset_revisions for select to anon, authenticated using (
  owner_user_id = (select auth.uid()) or exists (select 1 from public.asset_publications p where p.revision_id = asset_revisions.id and p.is_active = true)
);
create policy asset_reviews_owner_read on public.asset_review_requests for select to authenticated
using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('creator-private','creator-private',false,5242880,array['image/png','image/webp','image/jpeg']),
 ('creator-global','creator-global',true,5242880,array['image/png','image/webp','image/jpeg']),
 ('avatars','avatars',true,2097152,array['image/png','image/webp','image/jpeg']),
 ('map-previews','map-previews',true,5242880,array['image/png','image/webp','image/jpeg'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types, public=excluded.public;

create policy creator_private_insert_own on storage.objects for insert to authenticated
with check (bucket_id='creator-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy creator_private_read_own on storage.objects for select to authenticated
using (bucket_id='creator-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy creator_private_delete_own on storage.objects for delete to authenticated
using (bucket_id='creator-private' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy avatars_insert_own on storage.objects for insert to authenticated
with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatars_update_own on storage.objects for update to authenticated
using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

comment on table public.asset_families is 'Stable creator asset identity and editable metadata; bytes are versioned separately.';
comment on table public.asset_revisions is 'Immutable creator asset revisions. Maps reference asset_id, never file paths.';
comment on table public.asset_publications is 'Server-approved mapping from immutable revision to public Storage object.';

commit;
