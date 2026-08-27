-- 0003_hand_engine.sql
-- Extiende el esquema para soportar el estado completo de una mano,
-- incluyendo historial de manos jugadas y campos adicionales del motor.

-- ── game_sessions: campos adicionales para el motor ──────────────────────────
alter table game_sessions
  add column last_raise_size int default 0,
  add column hand_number int default 0;

comment on column game_sessions.last_raise_size is
  'Tamaño de la última subida en la ronda actual. Se resetea al cambiar de calle.';
comment on column game_sessions.hand_number is
  'Número secuencial de la mano actual en esta sala.';

-- ── room_players: tracking por ronda ────────────────────────────────────────
alter table room_players
  add column acted_this_round boolean default false,
  add column total_committed int default 0;

comment on column room_players.acted_this_round is
  'Si el jugador ya actuó en la ronda de apuestas actual. Se resetea al cambiar de calle.';
comment on column room_players.total_committed is
  'Total acumulado que el jugador apostó en esta mano (todas las calles). Se usa para calcular side pots.';

-- ── hand_history: manos completadas ──────────────────────────────────────────
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

comment on table hand_history is
  'Historial de manos completadas para reproducir la acción y ver resultados.';
comment on column hand_history.winners is
  'Array de objetos { playerId, username, amountWon }.';
comment on column hand_history.showdown_hands is
  'Array de objetos { playerId, username, holeCards, descr } — sólo en manos con showdown.';
comment on column hand_history.actions_log is
  'Array ordenado de acciones { playerId, action, amount, phase } para reproductor paso a paso.';

-- ── RLS para hand_history ───────────────────────────────────────────────────
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

-- Solo service_role puede insertar (el motor de servidor).
