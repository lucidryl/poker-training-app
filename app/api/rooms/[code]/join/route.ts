import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

interface RouteParams {
  params: { code: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const serviceClient = createServiceRoleClient();

  // Buscar sala por código
  const { data: room, error: roomError } = await serviceClient
    .from("rooms")
    .select("*")
    .eq("room_code", params.code)
    .eq("is_active", true)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Sala no encontrada." }, { status: 404 });
  }

  // Verificar si ya está en la sala
  const { data: existingPlayer } = await serviceClient
    .from("room_players")
    .select("seat_number")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingPlayer) {
    return NextResponse.json({
      roomCode: room.room_code,
      roomId: room.id,
      seatNumber: existingPlayer.seat_number,
      alreadyJoined: true,
    });
  }

  // Contar jugadores actuales
  const { count } = await serviceClient
    .from("room_players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);

  if ((count ?? 0) >= room.max_players) {
    return NextResponse.json({ error: "Sala llena." }, { status: 409 });
  }

  // Encontrar siguiente asiento libre
  const { data: takenSeats } = await serviceClient
    .from("room_players")
    .select("seat_number")
    .eq("room_id", room.id);

  const taken = new Set((takenSeats ?? []).map((s: { seat_number: number }) => s.seat_number));
  let seatNumber = 0;
  while (taken.has(seatNumber) && seatNumber < room.max_players) {
    seatNumber++;
  }

  if (seatNumber >= room.max_players) {
    return NextResponse.json({ error: "No hay asientos disponibles." }, { status: 409 });
  }

  // Unirse a la sala
  const { error: joinError } = await serviceClient
    .from("room_players")
    .insert({
      room_id: room.id,
      user_id: user.id,
      seat_number: seatNumber,
      stack: room.starting_stack,
      current_bet: 0,
      hand_cards: [],
      is_folded: false,
      is_all_in: false,
      acted_this_round: false,
      total_committed: 0,
    });

  if (joinError) {
    return NextResponse.json({ error: joinError.message }, { status: 500 });
  }

  return NextResponse.json({
    roomCode: room.room_code,
    roomId: room.id,
    seatNumber,
  });
}
