-- 0001_init.sql
-- Esquema base según la especificación del proyecto (sección 3).

create extension if not exists pgcrypto;

-- Tabla de Perfiles de Usuario
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar_url text,
  play_chips bigint default 10000,
  created_at timestamptz default now()
);

-- Tabla de Salas Privadas
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

-- Estado Actual de la Mesa (Snapshot/Realtime State)
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

-- Jugadores en la Mesa
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
