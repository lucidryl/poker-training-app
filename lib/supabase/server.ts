import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Cliente Supabase con contexto de sesión (RLS aplicado según el usuario autenticado).
 * Usar en Server Components y Route Handlers.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options?: Record<string, unknown>) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

/**
 * Cliente con Service Role — sólo para Edge Functions / lógica de servidor de confianza
 * que necesita saltarse RLS (p.ej. el motor de juego resolviendo un showdown).
 * NUNCA exponer esta key al cliente.
 */
export function createServiceRoleClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
