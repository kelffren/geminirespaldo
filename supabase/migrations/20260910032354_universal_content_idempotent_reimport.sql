begin;

-- Re-importing the same spreadsheet row must reuse the stable asset family.
-- Immutable asset revisions still create a new revision only when content_hash changes.
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
declare
  v_uid uuid := (select auth.uid());
  v_slug text := lower(trim(p_slug));
  v_row public.asset_families;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9_-]{1,62}$' then raise exception 'INVALID_ASSET_SLUG'; end if;
  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 80 then raise exception 'INVALID_ASSET_NAME'; end if;

  insert into public.asset_families(
    stable_key, owner_user_id, slug, name, kind, category, semantic_family, tags, districts, metadata
  ) values (
    'creator:' || v_uid::text || ':' || v_slug,
    v_uid,
    v_slug,
    trim(p_name),
    coalesce(p_kind,'prop'),
    nullif(trim(coalesce(p_category,'')),''),
    nullif(trim(coalesce(p_semantic_family,'')),''),
    coalesce(p_tags,'{}'),
    coalesce(p_districts,'{}'),
    coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (owner_user_id, slug) do update set
    name = excluded.name,
    kind = excluded.kind,
    category = excluded.category,
    semantic_family = excluded.semantic_family,
    tags = excluded.tags,
    districts = excluded.districts,
    metadata = public.asset_families.metadata || excluded.metadata,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_asset_family(text,text,text,text,text,text[],text[],jsonb) from public, anon;
grant execute on function public.create_asset_family(text,text,text,text,text,text[],text[],jsonb) to authenticated, service_role;

commit;
