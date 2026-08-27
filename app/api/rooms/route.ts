import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

const createRoomSchema = z.object({
  name: z.string().min(1).max(60),
  small_blind: z.number().int().positive().default(10),
  big_blind: z.number().int().positive().default(20),
  starting_stack: z.number().int().positive().default(1000),
  max_players: z.number().int().min(2).max(9).default(6),
  turn_time_limit: z.number().int().min(5).max(120).default(30),
});

function generateRoomCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () =>
    alphabet.charAt(Math.floor(Math.random() * alphabet.length))
  ).join("");
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createRoomSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const serviceClient = createServiceRoleClient();
  const data = parsed.data;

  // Generar código único con reintentos
  let roomCode = generateRoomCode();
  let attempts = 0;
  while (attempts < 10) {
    const { data: existing } = await serviceClient
      .from("rooms")
      .select("room_code")
      .eq("room_code", roomCode)
      .maybeSingle();

    if (!existing) break;
    roomCode = generateRoomCode();
    attempts++;
  }

  // Crear sala
  const { data: room, error: roomError } = await serviceClient
    .from("rooms")
    .insert({
      room_code: roomCode,
      host_id: user.id,
      name: data.name,
      small_blind: data.small_blind,
      big_blind: data.big_blind,
      starting_stack: data.starting_stack,
      max_players: data.max_players,
      turn_time_limit: data.turn_time_limit,
    })
    .select()
    .single();

  if (roomError) {
    return NextResponse.json({ error: roomError.message }, { status: 500 });
  }

  // Crear sesión de juego inicial
  const { error: sessionError } = await serviceClient
    .from("game_sessions")
    .insert({
      room_id: room.id,
      phase: "WAITING",
      community_cards: [],
      pot: 0,
      current_bet: 0,
      dealer_position: 0,
      current_turn_position: 0,
      deck: [],
      last_raise_size: 0,
      hand_number: 0,
    });

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  // Auto-unirse a la sala como host en el asiento 0
  const { error: playerError } = await serviceClient
    .from("room_players")
    .insert({
      room_id: room.id,
      user_id: user.id,
      seat_number: 0,
      stack: data.starting_stack,
      current_bet: 0,
      hand_cards: [],
      is_folded: false,
      is_all_in: false,
      acted_this_round: false,
      total_committed: 0,
    });

  if (playerError) {
    return NextResponse.json({ error: playerError.message }, { status: 500 });
  }

  return NextResponse.json({
    roomCode: room.room_code,
    roomId: room.id,
  });
}
