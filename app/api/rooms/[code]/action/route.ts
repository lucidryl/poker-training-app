import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  applyAction as engineApplyAction,
  type EngineGameState,
  type EnginePlayer,
  type EngineRoomSettings,
} from "@/lib/poker-engine/engine";
import type { CardCode } from "@/lib/poker-engine/deck";
import type { PlayerAction } from "@/lib/supabase/types";

const actionSchema = z.object({
  action: z.enum(["FOLD", "CHECK", "CALL", "BET", "RAISE"]),
  amount: z.number().int().nonnegative().optional(),
});

interface RouteParams {
  params: { code: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const body = await request.json();
  const parsed = actionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { action, amount } = parsed.data;

  // Validaciones para BET/RAISE
  if ((action === "BET" || action === "RAISE") && (amount === undefined || amount <= 0)) {
    return NextResponse.json(
      { error: "Se requiere un monto para BET/RAISE." },
      { status: 400 }
    );
  }

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

  // Obtener sesión actual
  const { data: session, error: sessionError } = await serviceClient
    .from("game_sessions")
    .select("*")
    .eq("room_id", room.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Sesión de juego no encontrada." }, { status: 404 });
  }

  if (session.phase === "WAITING" || session.phase === "SHOWDOWN") {
    return NextResponse.json({ error: "No hay mano en curso." }, { status: 409 });
  }

  // Obtener jugadores con usernames
  const { data: playersData, error: playersError } = await serviceClient
    .from("room_players")
    .select("*, profiles!inner(username)")
    .eq("room_id", room.id)
    .order("seat_number");

  if (playersError || !playersData) {
    return NextResponse.json({ error: "Error al obtener jugadores." }, { status: 500 });
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
    username: (p.profiles as { username: string }).username,
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
  let result;
  try {
    result = engineApplyAction(
      engineSession,
      enginePlayers,
      settings,
      user.id,
      action as PlayerAction,
      amount
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Persistir cambios en game_sessions
  const sessionUpdate: Record<string, unknown> = {
    community_cards: result.session.communityCards ?? engineSession.communityCards,
    pot: result.session.pot ?? engineSession.pot,
    current_bet: result.session.currentBet ?? engineSession.currentBet,
    current_turn_position: result.session.currentTurnPosition ?? engineSession.currentTurnPosition,
    phase: result.session.phase ?? engineSession.phase,
    deck: result.session.deck ?? engineSession.deck,
    last_raise_size: result.session.lastRaiseSize ?? engineSession.lastRaiseSize,
    dealer_position: result.session.dealerPosition ?? engineSession.dealerPosition,
    hand_number: result.session.handNumber ?? engineSession.handNumber,
  };

  const { error: updateSessionError } = await serviceClient
    .from("game_sessions")
    .update(sessionUpdate)
    .eq("room_id", room.id);

  if (updateSessionError) {
    return NextResponse.json({ error: updateSessionError.message }, { status: 500 });
  }

  // Persistir cambios en room_players
  for (const p of result.players) {
    const playerUpdate: Record<string, unknown> = {
      stack: p.stack,
      current_bet: p.currentBet,
      hand_cards: p.handCards,
      is_folded: p.isFolded,
      is_all_in: p.isAllIn,
      acted_this_round: p.actedThisRound,
      total_committed: p.totalCommitted,
    };

    const { error: updatePlayerError } = await serviceClient
      .from("room_players")
      .update(playerUpdate)
      .eq("room_id", room.id)
      .eq("user_id", p.userId);

    if (updatePlayerError) {
      return NextResponse.json({ error: updatePlayerError.message }, { status: 500 });
    }
  }

  // Si la mano terminó, guardar historial
  if (result.handComplete && result.handHistory) {
    const hh = result.handHistory;
    await serviceClient.from("hand_history").insert({
      room_id: room.id,
      hand_number: hh.handNumber,
      community_cards: hh.communityCards,
      pot_total: hh.potTotal,
      winners: hh.winners,
      showdown_hands: hh.showdownHands,
      actions_log: hh.actionsLog,
    });
  }

  return NextResponse.json({ ok: true });
}
