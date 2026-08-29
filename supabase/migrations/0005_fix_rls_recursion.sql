-- 0005_fix_rls_recursion.sql
-- Corrección de recursión infinita en políticas RLS.
--
-- El problema: "room_players_select_seated" consultaba room_players dentro de su
-- propia política (self-reference), lo que Postgres rechaza con
-- "infinite recursion detected in policy for relation room_players".
-- Las políticas de game_sessions y room_players dependían de ese check.

-- Función helper SECURITY DEFINER: verifica si el usuario está sentado en la sala.
-- Corre con privilegios del owner y NO aplica RLS internamente → elimina la recursión.
create or replace function public.is_seated(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room_id
      and user_id = auth.uid()
  );
$$;

-- Reescribir política de room_players usando el helper
drop policy if exists "room_players_select_seated" on room_players;
create policy "room_players_select_seated"
  on room_players for select
  using (public.is_seated(room_id));

-- Reescribir política de game_sessions usando el helper
drop policy if exists "game_sessions_select_seated" on game_sessions;
create policy "game_sessions_select_seated"
  on game_sessions for select
  using (public.is_seated(room_id));

-- Conceder ejecución del helper al rol autenticado para que las policies funcionen
grant execute on function public.is_seated(uuid) to authenticated, anon;