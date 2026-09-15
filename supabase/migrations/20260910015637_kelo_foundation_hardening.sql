begin;

create index if not exists account_roles_granted_by_idx on public.account_roles(granted_by) where granted_by is not null;
create index if not exists asset_publications_published_by_idx on public.asset_publications(published_by) where published_by is not null;
create index if not exists asset_review_decided_by_idx on public.asset_review_requests(decided_by) where decided_by is not null;
create index if not exists map_publications_published_by_idx on public.map_publications(published_by) where published_by is not null;
create index if not exists nobility_history_player_created_idx on public.nobility_history(player_id,created_at desc);
create index if not exists server_audit_actor_idx on public.server_audit_events(actor_user_id,created_at desc) where actor_user_id is not null;

-- The live bootstrap project had this legacy helper. A fresh local Supabase stack
-- may not, so hardening must remain replay-safe from an empty database.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

create policy equipment_items_service_only_deny on public.equipment_items for all to anon,authenticated using(false) with check(false);
create policy forge_history_service_only_deny on public.forge_history for all to anon,authenticated using(false) with check(false);
create policy nobility_players_service_only_deny on public.nobility_players for all to anon,authenticated using(false) with check(false);
create policy nobility_history_service_only_deny on public.nobility_history for all to anon,authenticated using(false) with check(false);
create policy server_idempotency_service_only_deny on public.server_idempotency for all to anon,authenticated using(false) with check(false);
create policy server_outbox_service_only_deny on public.server_outbox for all to anon,authenticated using(false) with check(false);
create policy server_audit_service_only_deny on public.server_audit_events for all to anon,authenticated using(false) with check(false);

comment on function public.create_character(text) is 'Intentional SECURITY DEFINER API: validates auth.uid and enforces the character quota; direct INSERT is not granted.';
comment on function public.create_asset_family(text,text,text,text,text,text[],text[],jsonb) is 'Intentional SECURITY DEFINER API: validates auth.uid and generates stable creator-owned IDs; direct INSERT is not granted.';
comment on function public.register_asset_revision(uuid,text,text,text,bigint,integer,integer,numeric,numeric,text,text,jsonb) is 'Intentional SECURITY DEFINER API: validates owner/path/hash/limits and allocates immutable revision IDs atomically.';
comment on function public.submit_asset_revision(uuid) is 'Intentional SECURITY DEFINER API: owner-only transition into moderation queue.';
comment on function public.create_map(text,text,text) is 'Intentional SECURITY DEFINER API: validates auth.uid and creates stable map identity.';
comment on function public.register_map_version(uuid,text,integer,jsonb,jsonb,text[]) is 'Intentional SECURITY DEFINER API: validates ownership/assets and allocates immutable map versions atomically.';
comment on function public.claim_legacy_player_key(uuid,text) is 'Intentional SECURITY DEFINER migration bridge: only the owning account can claim its character key.';

commit;
