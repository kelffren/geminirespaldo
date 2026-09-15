begin;

create schema if not exists kelo_private;
revoke all on schema kelo_private from public, anon;
grant usage on schema kelo_private to authenticated, service_role;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text,
  display_name text,
  avatar_path text,
  locale text not null default 'es' check (char_length(locale) between 2 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_length check (handle is null or char_length(handle) between 3 and 24),
  constraint profiles_handle_format check (handle is null or handle ~ '^[A-Za-z0-9_]+$'),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 40)
);
create unique index if not exists profiles_handle_lower_uidx on public.profiles (lower(handle)) where handle is not null;

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  legacy_player_key text unique,
  status text not null default 'active' check (status in ('active','archived','banned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  constraint characters_name_length check (char_length(name) between 3 and 24),
  constraint characters_name_format check (name ~ '^[[:alnum:] _.-]+$')
);
create unique index if not exists characters_name_lower_uidx on public.characters (lower(name));
create index if not exists characters_account_idx on public.characters(account_id, created_at);
create index if not exists characters_legacy_player_key_idx on public.characters(legacy_player_key) where legacy_player_key is not null;

create table if not exists public.role_definitions (
  role_key text primary key,
  description text not null,
  created_at timestamptz not null default now()
);
insert into public.role_definitions(role_key, description) values
  ('player','Jugador base'),
  ('creator','Puede crear y someter contenido'),
  ('moderator','Puede revisar contenido y moderación'),
  ('admin','Administración de Kelo World'),
  ('official','Puede publicar contenido oficial')
on conflict (role_key) do update set description = excluded.description;

create table if not exists public.account_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null references public.role_definitions(role_key) on delete restrict,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key(user_id, role_key)
);
create index if not exists account_roles_user_idx on public.account_roles(user_id);
create index if not exists account_roles_role_idx on public.account_roles(role_key, user_id);

create or replace function kelo_private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;

create or replace function kelo_private.has_role(p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.account_roles ar where ar.user_id = (select auth.uid()) and ar.role_key = p_role);
$$;
revoke all on function kelo_private.has_role(text) from public, anon;
grant execute on function kelo_private.has_role(text) to authenticated, service_role;

create or replace function kelo_private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id, display_name, avatar_path)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', ''), 40), ''),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  ) on conflict (user_id) do nothing;
  insert into public.account_roles(user_id, role_key) values (new.id, 'player') on conflict do nothing;
  return new;
end;
$$;

create or replace function public.create_character(p_name text)
returns public.characters language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_count integer; v_row public.characters;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_name is null or char_length(trim(p_name)) < 3 or char_length(trim(p_name)) > 24 then raise exception 'INVALID_CHARACTER_NAME'; end if;
  select count(*) into v_count from public.characters where account_id = v_uid and status <> 'archived';
  if v_count >= 3 then raise exception 'CHARACTER_LIMIT_REACHED'; end if;
  insert into public.characters(account_id, name) values (v_uid, trim(p_name)) returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.create_character(text) from public, anon;
grant execute on function public.create_character(text) to authenticated, service_role;

create or replace function public.claim_legacy_player_key(p_character_id uuid, p_player_key text)
returns public.characters language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_row public.characters;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_player_key is null or p_player_key !~ '^[0-9a-fA-F-]{36}$' then raise exception 'INVALID_PLAYER_KEY'; end if;
  update public.characters
    set legacy_player_key = lower(p_player_key), updated_at = now()
    where id = p_character_id and account_id = v_uid and (legacy_player_key is null or legacy_player_key = lower(p_player_key))
    returning * into v_row;
  if v_row.id is null then raise exception 'CHARACTER_NOT_FOUND_OR_KEY_CONFLICT'; end if;
  return v_row;
end;
$$;
revoke all on function public.claim_legacy_player_key(uuid,text) from public, anon;
grant execute on function public.claim_legacy_player_key(uuid,text) to authenticated, service_role;

create trigger profiles_touch_updated_at before update on public.profiles for each row execute function kelo_private.touch_updated_at();
create trigger characters_touch_updated_at before update on public.characters for each row execute function kelo_private.touch_updated_at();
create trigger on_auth_user_created after insert on auth.users for each row execute function kelo_private.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.role_definitions enable row level security;
alter table public.account_roles enable row level security;

revoke all on public.profiles, public.characters, public.role_definitions, public.account_roles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update(handle, display_name, avatar_path, locale) on public.profiles to authenticated;
grant select on public.characters to authenticated;
grant update(name) on public.characters to authenticated;
grant select on public.role_definitions to authenticated;
grant select on public.account_roles to authenticated;

create policy profiles_public_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy characters_read_own on public.characters for select to authenticated
using ((select auth.uid()) is not null and account_id = (select auth.uid()));
create policy characters_update_own on public.characters for update to authenticated
using ((select auth.uid()) is not null and account_id = (select auth.uid())) with check (account_id = (select auth.uid()));
create policy role_definitions_read_authenticated on public.role_definitions for select to authenticated using (true);
create policy account_roles_read_own on public.account_roles for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

comment on table public.profiles is 'Public account profile. Auth identity remains in auth.users.';
comment on table public.characters is 'Stable game-character identity; account and character are intentionally separate.';
comment on table public.account_roles is 'Server-managed account authorization roles; users may only read their own assignments.';

commit;
