-- KELO-INDEX SERVER/TITLES PERSISTENCE
-- Optional durable persistence for KeloTitles. Apply before setting KELO_TITLES_SUPABASE=1.
-- The WebSocket client never writes this table directly; server service-role remains authority.

create table if not exists public.title_players (
  player_id text primary key,
  progress jsonb not null default '{}'::jsonb,
  unlocked jsonb not null default '[]'::jsonb,
  equipped_title_id text null,
  kill_ledger jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists title_players_updated_at_idx on public.title_players(updated_at desc);
