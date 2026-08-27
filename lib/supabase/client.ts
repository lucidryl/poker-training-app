"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Uso típico para suscripción Realtime de una sala:
//
// const supabase = createClient();
// const channel = supabase
//   .channel(`room:${roomCode}`)
//   .on(
//     "postgres_changes",
//     { event: "*", schema: "public", table: "game_sessions", filter: `room_id=eq.${roomId}` },
//     (payload) => { /* actualizar estado local */ }
//   )
//   .subscribe();
