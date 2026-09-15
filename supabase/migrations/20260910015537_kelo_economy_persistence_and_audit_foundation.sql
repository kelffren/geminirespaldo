begin;

create or replace function kelo_private.owns_character(p_character_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.characters c where c.id=p_character_id and c.account_id=(select auth.uid()));
$$;
revoke all on function kelo_private.owns_character(uuid) from public, anon;
grant execute on function kelo_private.owns_character(uuid) to authenticated, service_role;

create table if not exists public.character_wallets (
  character_id uuid not null references public.characters(id) on delete cascade,
  currency_key text not null,
  amount bigint not null default 0 check (amount >= 0),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  primary key(character_id,currency_key),
  constraint wallet_currency_format check (currency_key ~ '^[a-z][a-z0-9_]{1,31}$')
);
create index if not exists character_wallets_currency_idx on public.character_wallets(currency_key, amount desc);

create table if not exists public.wallet_ledger (
  id bigint generated always as identity primary key,
  character_id uuid not null references public.characters(id) on delete cascade,
  currency_key text not null,
  delta bigint not null check (delta <> 0),
  balance_after bigint not null check (balance_after >= 0),
  reason_key text not null,
  correlation_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(character_id,currency_key,correlation_id)
);
create index if not exists wallet_ledger_character_idx on public.wallet_ledger(character_id,created_at desc);
create index if not exists wallet_ledger_reason_idx on public.wallet_ledger(reason_key,created_at desc);

create table if not exists public.item_instances (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  template_id text not null,
  quantity bigint not null default 1 check (quantity > 0),
  bind_state text not null default 'unbound' check (bind_state in ('unbound','account','character')),
  attributes jsonb not null default '{}'::jsonb,
  acquired_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists item_instances_character_idx on public.item_instances(character_id,created_at desc);
create index if not exists item_instances_template_idx on public.item_instances(template_id,character_id);

create table if not exists public.character_equipment (
  character_id uuid not null references public.characters(id) on delete cascade,
  slot_key text not null,
  item_id uuid not null unique references public.item_instances(id) on delete restrict,
  equipped_at timestamptz not null default now(),
  primary key(character_id,slot_key),
  constraint character_equipment_slot_format check (slot_key ~ '^[a-z][a-z0-9_]{1,31}$')
);
create index if not exists character_equipment_item_idx on public.character_equipment(item_id);

create table if not exists public.character_state_snapshots (
  character_id uuid primary key references public.characters(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  schema_version integer not null default 1 check (schema_version > 0),
  zone_key text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.server_idempotency (
  scope text not null,
  idempotency_key text not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key(scope,idempotency_key)
);
create index if not exists server_idempotency_expiry_idx on public.server_idempotency(expires_at) where expires_at is not null;

create table if not exists public.server_outbox (
  id bigint generated always as identity primary key,
  topic text not null,
  event_key text not null,
  aggregate_type text,
  aggregate_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists server_outbox_pending_idx on public.server_outbox(status,available_at,id) where status in ('pending','failed');
create index if not exists server_outbox_aggregate_idx on public.server_outbox(aggregate_type,aggregate_id,created_at desc);

create table if not exists public.server_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  character_id uuid references public.characters(id) on delete set null,
  event_key text not null,
  target_type text,
  target_id text,
  request_id text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists server_audit_event_idx on public.server_audit_events(event_key,created_at desc);
create index if not exists server_audit_character_idx on public.server_audit_events(character_id,created_at desc) where character_id is not null;
create index if not exists server_audit_request_idx on public.server_audit_events(request_id) where request_id is not null;

create or replace function public.apply_wallet_delta(
  p_character_id uuid, p_currency_key text, p_delta bigint, p_reason_key text,
  p_correlation_id uuid, p_metadata jsonb default '{}'::jsonb
)
returns public.wallet_ledger language plpgsql security definer set search_path = '' as $$
declare
  v_wallet public.character_wallets; v_existing public.wallet_ledger; v_row public.wallet_ledger; v_new_amount bigint;
begin
  if p_delta is null or p_delta = 0 then raise exception 'INVALID_DELTA'; end if;
  if p_currency_key is null or p_currency_key !~ '^[a-z][a-z0-9_]{1,31}$' then raise exception 'INVALID_CURRENCY'; end if;
  if p_reason_key is null or char_length(trim(p_reason_key)) < 1 then raise exception 'INVALID_REASON'; end if;
  if p_correlation_id is null then raise exception 'CORRELATION_ID_REQUIRED'; end if;
  if not exists(select 1 from public.characters where id=p_character_id) then raise exception 'CHARACTER_NOT_FOUND'; end if;

  select * into v_existing from public.wallet_ledger
  where character_id=p_character_id and currency_key=p_currency_key and correlation_id=p_correlation_id;
  if v_existing.id is not null then return v_existing; end if;

  insert into public.character_wallets(character_id,currency_key,amount,revision)
  values(p_character_id,p_currency_key,0,0) on conflict(character_id,currency_key) do nothing;

  select * into v_wallet from public.character_wallets
  where character_id=p_character_id and currency_key=p_currency_key for update;

  v_new_amount := v_wallet.amount + p_delta;
  if v_new_amount < 0 then raise exception 'INSUFFICIENT_FUNDS'; end if;

  update public.character_wallets set amount=v_new_amount,revision=revision+1,updated_at=now()
  where character_id=p_character_id and currency_key=p_currency_key;

  insert into public.wallet_ledger(character_id,currency_key,delta,balance_after,reason_key,correlation_id,metadata)
  values(p_character_id,p_currency_key,p_delta,v_new_amount,trim(p_reason_key),p_correlation_id,coalesce(p_metadata,'{}'::jsonb))
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.apply_wallet_delta(uuid,text,bigint,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.apply_wallet_delta(uuid,text,bigint,text,uuid,jsonb) to service_role;

create or replace function kelo_private.validate_equipment_owner()
returns trigger language plpgsql set search_path = '' as $$
declare v_owner uuid;
begin
  select i.character_id into v_owner from public.item_instances i where i.id=new.item_id;
  if v_owner is null or v_owner <> new.character_id then raise exception 'ITEM_OWNER_MISMATCH'; end if;
  return new;
end;
$$;

create trigger item_instances_touch_updated_at before update on public.item_instances for each row execute function kelo_private.touch_updated_at();
create trigger character_equipment_validate before insert or update on public.character_equipment for each row execute function kelo_private.validate_equipment_owner();

alter table public.character_wallets enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.item_instances enable row level security;
alter table public.character_equipment enable row level security;
alter table public.character_state_snapshots enable row level security;
alter table public.server_idempotency enable row level security;
alter table public.server_outbox enable row level security;
alter table public.server_audit_events enable row level security;

revoke all on public.character_wallets, public.wallet_ledger, public.item_instances, public.character_equipment, public.character_state_snapshots, public.server_idempotency, public.server_outbox, public.server_audit_events from anon, authenticated;
grant select on public.character_wallets, public.wallet_ledger, public.item_instances, public.character_equipment, public.character_state_snapshots to authenticated;

create policy character_wallets_read_own on public.character_wallets for select to authenticated using (kelo_private.owns_character(character_id));
create policy wallet_ledger_read_own on public.wallet_ledger for select to authenticated using (kelo_private.owns_character(character_id));
create policy item_instances_read_own on public.item_instances for select to authenticated using (kelo_private.owns_character(character_id));
create policy character_equipment_read_own on public.character_equipment for select to authenticated using (kelo_private.owns_character(character_id));
create policy character_state_read_own on public.character_state_snapshots for select to authenticated using (kelo_private.owns_character(character_id));

comment on table public.character_wallets is 'Current materialized balances; authoritative writes occur through trusted server/RPC only.';
comment on table public.wallet_ledger is 'Append-only balance history with idempotent correlation IDs.';
comment on table public.item_instances is 'Canonical item instance ownership for PlayerEconomyStore persistence; not a second gameplay owner.';
comment on table public.server_outbox is 'Transactional outbox for durable cross-service/broadcast work.';
comment on table public.server_audit_events is 'Security/operations audit trail; service role only.';

commit;
