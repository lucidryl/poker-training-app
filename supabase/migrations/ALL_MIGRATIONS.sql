-- ============================================
-- MIGRACIÓN COMPLETA: Ejecutar en SQL Editor
-- ============================================

-- 0001_init.sql
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar_url text,
  play_chips bigint default 10000,
  created_at timestamptz default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_code varchar(8) unique not null,
  host_id uuid references profiles(id),
  name text not null,
  small_blind int default 10,
  big_blind int default 20,
  starting_stack int default 1000,
  max_players int default 6 check (max_players between 2 and 9),
  turn_time_limit int default 30,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table game_sessions (
  room_id uuid primary key references rooms(id) on delete cascade,
  community_cards jsonb default '[]',
  pot int default 0,
  current_bet int default 0,
  dealer_position int default 0,
  current_turn_position int default 0,
  phase text default 'WAITING'
    check (phase in ('WAITING','PREFLOP','FLOP','TURN','RIVER','SHOWDOWN')),
  deck jsonb default '[]',
  updated_at timestamptz default now()
);

create table room_players (
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  seat_number int not null,
  stack int not null,
  current_bet int default 0,
  hand_cards jsonb default '[]',
  is_folded boolean default false,
  is_all_in boolean default false,
  primary key (room_id, seat_number)
);

create index idx_room_players_room_id on room_players(room_id);
create index idx_rooms_room_code on rooms(room_code);

-- 0002_rls.sql
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table game_sessions enable row level security;
alter table room_players enable row level security;

create policy "profiles_select_all"
  on profiles for select using (true);

create policy "profiles_update_own"
  on profiles for update using (auth.uid() = id);

create policy "rooms_select_all"
  on rooms for select using (true);

create policy "rooms_insert_own"
  on rooms for insert with check (auth.uid() = host_id);

create policy "rooms_update_host"
  on rooms for update using (auth.uid() = host_id);

create policy "game_sessions_select_seated"
  on game_sessions for select
  using (
    exists (
      select 1 from room_players rp
      where rp.room_id = game_sessions.room_id
        and rp.user_id = auth.uid()
    )
  );

create policy "room_players_select_seated"
  on room_players for select
  using (
    exists (
      select 1 from room_players self
      where self.room_id = room_players.room_id
        and self.user_id = auth.uid()
    )
  );

create view public_room_players as
  select
    room_id, user_id, seat_number, stack, current_bet, is_folded, is_all_in,
    case when user_id = auth.uid() then hand_cards else '[]'::jsonb end as hand_cards
  from room_players;

-- 0003_hand_engine.sql
alter table game_sessions
  add column last_raise_size int default 0,
  add column hand_number int default 0;

alter table room_players
  add column acted_this_round boolean default false,
  add column total_committed int default 0;

create table hand_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  hand_number int not null,
  community_cards jsonb default '[]',
  pot_total int default 0,
  winners jsonb default '[]',
  showdown_hands jsonb default '[]',
  actions_log jsonb default '[]',
  created_at timestamptz default now()
);

create index idx_hand_history_room_id on hand_history(room_id, hand_number desc);

alter table hand_history enable row level security;

create policy "hand_history_select_seated"
  on hand_history for select
  using (
    exists (
      select 1 from room_players rp
      where rp.room_id = hand_history.room_id
        and rp.user_id = auth.uid()
    )
  );
