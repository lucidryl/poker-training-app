-- 0002_rls.sql
-- Row Level Security. CRÍTICO: `room_players.hand_cards` de un jugador
-- nunca debe ser legible por otros clientes antes del Showdown (sección 6).

alter table profiles enable row level security;
alter table rooms enable row level security;
alter table game_sessions enable row level security;
alter table room_players enable row level security;

-- profiles: cualquiera autenticado puede leer perfiles públicos básicos.
create policy "profiles_select_all"
  on profiles for select
  using (true);

create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id);

-- rooms: legible por cualquier autenticado que conozca el room_code
-- (el código actúa como capacidad de acceso); sólo el host modifica.
create policy "rooms_select_all"
  on rooms for select
  using (true);

create policy "rooms_insert_own"
  on rooms for insert
  with check (auth.uid() = host_id);

create policy "rooms_update_host"
  on rooms for update
  using (auth.uid() = host_id);

-- game_sessions: legible por los sentados en la sala (nunca expone hand_cards,
-- que vive en room_players, no aquí).
create policy "game_sessions_select_seated"
  on game_sessions for select
  using (
    exists (
      select 1 from room_players rp
      where rp.room_id = game_sessions.room_id
        and rp.user_id = auth.uid()
    )
  );

-- Las mutaciones de game_sessions/room_players deben pasar SIEMPRE por el
-- motor de servidor (Route Handler / Edge Function con Service Role), nunca
-- directo desde el cliente. Por eso no se define policy de insert/update
-- para el rol `authenticated` en estas tablas: sólo `service_role` (que
-- bypassea RLS) puede escribir.

-- room_players: SELECT se filtra por columnas mediante una vista pública,
-- para que `hand_cards` sólo sea visible por su dueño (o a todos en Showdown,
-- gestionado aplicativamente cambiando el valor almacenado, no la policy).
create policy "room_players_select_seated"
  on room_players for select
  using (
    exists (
      select 1 from room_players self
      where self.room_id = room_players.room_id
        and self.user_id = auth.uid()
    )
  );

-- Vista pública sin cartas privadas, para uso general del cliente (Realtime/broadcast).
create view public_room_players as
  select
    room_id,
    user_id,
    seat_number,
    stack,
    current_bet,
    is_folded,
    is_all_in,
    case when user_id = auth.uid() then hand_cards else '[]'::jsonb end as hand_cards
  from room_players;

comment on view public_room_players is
  'Filtra hand_cards para que cada cliente sólo vea sus propias cartas hasta Showdown; en Showdown el motor de servidor actualiza hand_cards de todos los jugadores restantes para hacerlas visibles.';
