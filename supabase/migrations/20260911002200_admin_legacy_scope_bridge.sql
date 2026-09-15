begin;

insert into public.permission_definitions(permission_key,description) values
  ('admin.issue','Emitir llaves/entitlements administrativos compatibles'),
  ('admin.revoke','Revocar llaves/entitlements administrativos compatibles')
on conflict(permission_key) do update set description=excluded.description;

insert into public.role_permissions(role_key,permission_key) values
  ('admin','admin.issue'),('admin','admin.revoke')
on conflict do nothing;

commit;
