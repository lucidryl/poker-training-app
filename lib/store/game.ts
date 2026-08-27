"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Database, GamePhase } from "@/lib/supabase/types";
import type { CardCode } from "@/lib/poker-engine/deck";

type RealtimeChannel = ReturnType<ReturnType<typeof createClient>["channel"]>;

type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
type GameSessionRow = Database["public"]["Tables"]["game_sessions"]["Row"];
type RoomPlayerRow = Database["public"]["Tables"]["room_players"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface GameStore {
  // Estado
  room: RoomRow | null;
  session: GameSessionRow | null;
  players: RoomPlayerRow[];
  currentUser: ProfileRow | null;
  myPlayer: RoomPlayerRow | null;
  handHistory: HandHistoryEntry[];
  channel: RealtimeChannel | null;
  isLoading: boolean;
  error: string | null;

  // Acciones
  fetchRoom: (code: string) => Promise<void>;
  subscribeToRoom: (roomId: string) => void;
  unsubscribeFromRoom: () => void;
  sendAction: (code: string, action: string, amount?: number) => Promise<void>;
  startHand: (code: string) => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export interface HandHistoryEntry {
  handNumber: number;
  winners: { playerId: string; username: string; amountWon: number }[];
  showdownHands: { playerId: string; username: string; holeCards: string[]; descr: string }[];
  communityCards: string[];
}

export const useGameStore = create<GameStore>((set, get) => ({
  room: null,
  session: null,
  players: [],
  currentUser: null,
  myPlayer: null,
  handHistory: [],
  channel: null,
  isLoading: false,
  error: null,

  fetchRoom: async (code: string) => {
    set({ isLoading: true, error: null });
    const supabase = createClient();

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ isLoading: false, error: "No autenticado." });
      return;
    }

    // Obtener perfil
    const { data: profileRaw } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Obtener sala
    const { data: roomRaw, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("room_code", code)
      .single();

    if (roomError || !roomRaw) {
      set({ isLoading: false, error: "Sala no encontrada." });
      return;
    }

    const room = roomRaw as unknown as RoomRow;
    const roomId = room.id;

    // Obtener sesión
    const { data: sessionRaw } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("room_id", roomId)
      .single();

    // Obtener jugadores
    const { data: playersRaw } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", roomId)
      .order("seat_number");

    const session = sessionRaw as unknown as GameSessionRow | null;
    const players = (playersRaw ?? []) as unknown as RoomPlayerRow[];
    const myPlayer = players.find((p) => p.user_id === user.id) ?? null;

    set({
      room,
      session,
      players,
      currentUser: profileRaw as unknown as ProfileRow | null,
      myPlayer,
      isLoading: false,
    });

    // Suscribirse a Realtime
    get().subscribeToRoom(roomId);
  },

  subscribeToRoom: (roomId: string) => {
    const supabase = createClient();
    const state = get();

    // Limpiar suscripción anterior
    if (state.channel) {
      supabase.removeChannel(state.channel);
    }

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload: { eventType: string; new: unknown }) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const newData = payload.new as GameSessionRow;
            set({ session: newData });

            // Refrescar jugadores cuando cambia la sesión
            const { data: players } = await supabase
              .from("room_players")
              .select("*")
              .eq("room_id", roomId)
              .order("seat_number");

            if (players) {
              const user = await supabase.auth.getUser();
              const myPlayer = players.find(
                (p: RoomPlayerRow) => p.user_id === user.data.user?.id
              ) ?? null;
              set({ players, myPlayer });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          // Refrescar lista completa de jugadores
          const { data: players } = await supabase
            .from("room_players")
            .select("*")
            .eq("room_id", roomId)
            .order("seat_number");

          if (players) {
            const user = await supabase.auth.getUser();
            const myPlayer = players.find(
              (p: RoomPlayerRow) => p.user_id === user.data.user?.id
            ) ?? null;
            set({ players, myPlayer });
          }
        }
      )
      .subscribe();

    set({ channel });
  },

  unsubscribeFromRoom: () => {
    const { channel } = get();
    if (channel) {
      const supabase = createClient();
      supabase.removeChannel(channel);
      set({ channel: null });
    }
  },

  sendAction: async (code: string, action: string, amount?: number) => {
    set({ error: null });
    try {
      const body: Record<string, unknown> = { action };
      if (amount !== undefined) body.amount = amount;

      const res = await fetch(`/api/rooms/${code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error ?? "Error al enviar acción." });
      }
    } catch {
      set({ error: "Error de conexión." });
    }
  },

  startHand: async (code: string) => {
    set({ error: null, isLoading: true });
    try {
      const res = await fetch(`/api/rooms/${code}/start`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error ?? "Error al iniciar mano.", isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ error: "Error de conexión.", isLoading: false });
    }
  },

  joinRoom: async (code: string) => {
    set({ error: null, isLoading: true });
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error ?? "Error al unirse a la sala.", isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ error: "Error de conexión.", isLoading: false });
    }
  },

  setError: (error: string | null) => set({ error }),
}));
