begin;

create table if not exists public.nobility_players (
  player_id uuid primary key,
  name text not null check (char_length(name) between 1 and 24),
  gold bigint not null default 1500 check (gold >= 0),
  kc bigint not null default 200 check (kc >= 0),
  donation bigint not null default 0 check (donation >= 0),
  donated_today bigint not null default 0 check (donated_today >= 0),
  donation_day date not null default current_date,
  updated_at timestamptz not null default now()
);

create index if not exists nobility_players_donation_idx
  on public.nobility_players (donation desc, name asc);

create table if not exists public.nobility_history (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.nobility_players(player_id) on delete cascade,
  currency text not null check (currency in ('gold','kc')),
  spent bigint not null check (spent > 0),
  donation_added bigint not null check (donation_added > 0),
  created_at timestamptz not null default now()
);

alter table public.nobility_players enable row level security;
alter table public.nobility_history enable row level security;

create or replace function public.nobility_donate(
  p_player_id uuid,
  p_currency text,
  p_amount bigint
)
returns table (
  player_id uuid,
  name text,
  gold bigint,
  kc bigint,
  donation bigint,
  donated_today bigint,
  donation_day date,
  updated_at timestamptz,
  donation_added bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.nobility_players%rowtype;
  v_added bigint;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_currency not in ('gold','kc') then raise exception 'INVALID_CURRENCY'; end if;

  select * into v_player
  from public.nobility_players
  where nobility_players.player_id = p_player_id
  for update;

  if not found then raise exception 'PLAYER_NOT_FOUND'; end if;

  if v_player.donation_day <> current_date then
    update public.nobility_players
      set donated_today = 0, donation_day = current_date
      where nobility_players.player_id = p_player_id;
    v_player.donated_today := 0;
    v_player.donation_day := current_date;
  end if;

  if p_currency = 'gold' then
    if v_player.gold < p_amount then raise exception 'INSUFFICIENT_GOLD'; end if;
    v_added := p_amount;
    update public.nobility_players
      set gold = gold - p_amount,
          donation = donation + v_added,
          donated_today = donated_today + v_added,
          updated_at = now()
      where nobility_players.player_id = p_player_id
      returning * into v_player;
  else
    if v_player.kc < p_amount then raise exception 'INSUFFICIENT_KC'; end if;
    v_added := p_amount * 50000;
    update public.nobility_players
      set kc = kc - p_amount,
          donation = donation + v_added,
          donated_today = donated_today + v_added,
          updated_at = now()
      where nobility_players.player_id = p_player_id
      returning * into v_player;
  end if;

  insert into public.nobility_history(player_id, currency, spent, donation_added)
  values (p_player_id, p_currency, p_amount, v_added);

  return query select
    v_player.player_id, v_player.name, v_player.gold, v_player.kc,
    v_player.donation, v_player.donated_today, v_player.donation_day,
    v_player.updated_at, v_added;
end;
$$;

revoke all on function public.nobility_donate(uuid,text,bigint) from public;
revoke all on function public.nobility_donate(uuid,text,bigint) from anon;
revoke all on function public.nobility_donate(uuid,text,bigint) from authenticated;
grant execute on function public.nobility_donate(uuid,text,bigint) to service_role;

commit;
