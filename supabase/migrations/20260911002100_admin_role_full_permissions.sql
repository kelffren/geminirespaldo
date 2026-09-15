begin;

create or replace function kelo_private.permissions_for_user(p_user_id uuid)
returns text[] language sql stable security definer set search_path='' as $$
  select case
    when exists(select 1 from public.account_roles ar where ar.user_id=p_user_id and ar.role_key='admin')
      then coalesce((select array_agg(pd.permission_key order by pd.permission_key) from public.permission_definitions pd),array[]::text[])
    else coalesce((
      select array_agg(pd.permission_key order by pd.permission_key)
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
        )
    ),array[]::text[])
  end;
$$;

comment on function kelo_private.permissions_for_user(uuid) is 'Effective permissions: admin is full-access; other roles may be refined with explicit allow/deny overrides.';

commit;
