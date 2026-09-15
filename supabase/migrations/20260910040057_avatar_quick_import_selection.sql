begin;

alter table public.characters
  add column if not exists active_avatar_content_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'characters_active_avatar_content_fk'
  ) then
    alter table public.characters
      add constraint characters_active_avatar_content_fk
      foreign key (active_avatar_content_id)
      references public.content_definition_revisions(content_id)
      on delete set null;
  end if;
end $$;

create index if not exists characters_active_avatar_content_idx
  on public.characters(active_avatar_content_id)
  where active_avatar_content_id is not null;

create or replace function public.set_active_character_avatar(p_character_id uuid, p_content_id text)
returns public.characters
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.characters;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_content_id is not null and not exists(
    select 1
    from public.content_definition_revisions r
    join public.content_definitions d on d.id = r.definition_id
    where r.content_id = p_content_id
      and d.content_type = 'character'
      and r.owner_user_id = v_uid
      and coalesce(r.payload->'avatarRuntime'->>'bucket','') = 'avatars'
      and char_length(coalesce(r.payload->'avatarRuntime'->>'path','')) > 3
  ) then raise exception 'AVATAR_CONTENT_NOT_OWNED_OR_INVALID'; end if;

  update public.characters
     set active_avatar_content_id = p_content_id,
         updated_at = now()
   where id = p_character_id
     and account_id = v_uid
     and status = 'active'
  returning * into v_row;

  if v_row.id is null then raise exception 'CHARACTER_NOT_FOUND'; end if;
  return v_row;
end;
$$;
revoke all on function public.set_active_character_avatar(uuid,text) from public, anon;
grant execute on function public.set_active_character_avatar(uuid,text) to authenticated, service_role;

create or replace function public.get_avatar_manifest(p_content_id text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text := coalesce((select auth.role()), 'anon');
  v_row jsonb;
begin
  select jsonb_build_object(
    'contentId', r.content_id,
    'revision', r.revision,
    'displayName', d.display_name,
    'stableKey', d.stable_key,
    'payload', r.payload,
    'contentHash', r.content_hash
  ) into v_row
  from public.content_definition_revisions r
  join public.content_definitions d on d.id = r.definition_id
  where r.content_id = p_content_id
    and d.content_type = 'character'
    and (
      v_role = 'service_role'
      or r.owner_user_id = v_uid
      or exists(select 1 from public.content_publications p where p.revision_id = r.id and p.is_active = true)
    )
  limit 1;
  return v_row;
end;
$$;
revoke all on function public.get_avatar_manifest(text) from public, anon;
grant execute on function public.get_avatar_manifest(text) to authenticated, service_role;

comment on column public.characters.active_avatar_content_id is 'Immutable creator character revision selected as this character avatar.';
comment on function public.set_active_character_avatar(uuid,text) is 'Owner-only avatar selection. Selection references immutable character content, never a raw file path.';

commit;
