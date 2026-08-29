-- 0004_auto_profile.sql
-- Crea automáticamente el perfil cuando un usuario se registra en auth.users.
-- El nombre de usuario se toma de user_metadata (o del prefijo del email como fallback).
-- También rellena los perfiles de usuarios existentes que no tienen fila en profiles.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- Rellenar perfiles de usuarios ya existentes (seguro, idempotente)
insert into public.profiles (id, username)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

-- Política RLS para que el cliente también pueda crear su propio perfil
-- (fallback si el trigger no aplica, p.ej. migraciones parciales).
create policy "profiles_insert_own"
  on profiles for insert
  with check (auth.uid() = id);