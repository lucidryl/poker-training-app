import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  startHand as engineStartHand,
  type EngineGameState,
  type EnginePlayer,
  type EngineRoomSettings,
} from "@/lib/poker-engine/engine";
import type { CardCode } from "@/lib/poker-engine/deck";

interface RouteParams {
  params: { code: string };
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const supabase = createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const serviceClient = createServiceRoleClient();

  // Buscar sala
  const { data: room, error: roomError } = await serviceClient
    .from("rooms")
    .select("*")
    .eq("room_code", params.code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Sala no encontrada." }, { status: 404 });
  }

  // Verificar que el usuario es el host
  if (room.host_id !== user.id) {
    return NextResponse.json({ error: "Solo el anfitrión puede iniciar la mano." }, { status: 403 });
  }

  // Obtener sesión actual
  const { data: session, error: sessionError } = await serviceClient
    .from("game_sessions")
    .select("*")
    .eq("room_id", room.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Sesión de juego no encontrada." }, { status: 404 });
  }

  if (session.phase !== "WAITING") {
    return NextResponse.json({ error: "Ya hay una mano en curso." }, { status: 409 });
  }

  // Obtener jugadores
  const { data: playersData, error: playersError } = await serviceClient
    .from("room_players")
    .select("*")
    .eq("room_id", room.id)
    .order("seat_number");

  if (playersError || !playersData || playersData.length < 2) {
    return NextResponse.json({ error: "Se necesitan al menos 2 jugadores." }, { status: 409 });
  }

  // Mapear a tipos del motor
  const engineSession: EngineGameState = {
    roomId: room.id,
    communityCards: session.community_cards as CardCode[],
    pot: session.pot,
    currentBet: session.current_bet,
    dealerPosition: session.dealer_position,
    currentTurnPosition: session.current_turn_position,
    phase: session.phase as EngineGameState["phase"],
    deck: session.deck as CardCode[],
    lastRaiseSize: session.last_raise_size,
    handNumber: session.hand_number,
  };

  const enginePlayers: EnginePlayer[] = playersData.map((p: Record<string, unknown>) => ({
    userId: p.user_id as string,
    username: "", // Se completará desde profiles
    seatNumber: p.seat_number as number,
    stack: p.stack as number,
    currentBet: p.current_bet as number,
    handCards: (p.hand_cards as CardCode[]) ?? [],
    isFolded: p.is_folded as boolean,
    isAllIn: p.is_all_in as boolean,
    actedThisRound: p.acted_this_round as boolean,
    totalCommitted: p.total_committed as number,
  }));

  const settings: EngineRoomSettings = {
    smallBlind: room.small_blind,
    bigBlind: room.big_blind,
    startingStack: room.starting_stack,
    maxPlayers: room.max_players,
  };

  // Ejecutar motor
  const result = engineStartHand(engineSession, enginePlayers, settings);

  // Persistir cambios en game_sessions
  const { error: updateSessionError } = await serviceClient
    .from("game_sessions")
    .update({
      community_cards: result.session.communityCards ?? [],
      pot: result.session.pot ?? 0,
      current_bet: result.session.currentBet ?? 0,
      dealer_position: result.session.dealerPosition ?? session.dealer_position,
      current_turn_position: result.session.currentTurnPosition ?? 0,
      phase: result.session.phase ?? "PREFLOP",
      deck: result.session.deck ?? [],
      last_raise_size: result.session.lastRaiseSize ?? 0,
      hand_number: result.session.handNumber ?? session.hand_number,
    })
    .eq("room_id", room.id);

  if (updateSessionError) {
    return NextResponse.json({ error: updateSessionError.message }, { status: 500 });
  }

  // Persistir cambios en room_players (cartas, stacks, ciegas)
  for (const p of result.players) {
    const { error: updatePlayerError } = await serviceClient
      .from("room_players")
      .update({
        stack: p.stack,
        current_bet: p.currentBet,
        hand_cards: p.handCards,
        is_folded: p.isFolded,
        is_all_in: p.isAllIn,
        acted_this_round: p.actedThisRound,
        total_committed: p.totalCommitted,
      })
      .eq("room_id", room.id)
      .eq("user_id", p.userId);

    if (updatePlayerError) {
      return NextResponse.json({ error: updatePlayerError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
