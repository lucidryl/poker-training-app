"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useGameStore } from "@/lib/store/game";
import { Table } from "@/components/poker/Table";
import { HandHistory } from "@/components/poker/HandHistory";
import type { CardCode } from "@/lib/poker-engine/deck";

interface RoomPageProps {
  params: { code: string };
}

export default function RoomPage({ params }: RoomPageProps) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const {
    room,
    session,
    players,
    myPlayer,
    isLoading,
    error,
    fetchRoom,
    unsubscribeFromRoom,
    sendAction,
    startHand,
  } = useGameStore();
  const handHistoryEntries = useGameStore((s) => s.handHistory);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchRoom(params.code);
    }

    return () => {
      unsubscribeFromRoom();
    };
  }, [user, params.code, fetchRoom, unsubscribeFromRoom]);

  if (authLoading || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-table-felt">
        <p className="text-foreground">Cargando sala...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-table-felt">
        <p className="text-destructive">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="rounded bg-muted px-4 py-2 text-sm"
        >
          Volver al inicio
        </button>
      </main>
    );
  }

  if (!room || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-table-felt">
        <p className="text-foreground">Sala no encontrada.</p>
      </main>
    );
  }

  // Mapear jugadores a asientos para el componente Table
  const seats = Array.from({ length: room.max_players }, (_, i) => {
    const player = players.find((p: { seat_number: number }) => p.seat_number === i);
    if (!player) {
      return {
        seatNumber: i,
        userId: null,
        username: undefined,
        stack: 0,
        currentBet: 0,
        isFolded: false,
        isAllIn: false,
        isDealer: false,
        isCurrentTurn: false,
        holeCards: undefined,
      };
    }

    const isMe = player.user_id === user?.id;
    const isShowdown = session.phase === "SHOWDOWN";

    return {
      seatNumber: i,
      userId: player.user_id,
      username: isMe ? "Tú" : `Jugador ${i}`,
      stack: player.stack,
      currentBet: player.current_bet,
      isFolded: player.is_folded,
      isAllIn: player.is_all_in,
      isDealer: session.dealer_position === i,
      isCurrentTurn: session.current_turn_position === i && session.phase !== "WAITING",
      holeCards: isMe || isShowdown
        ? (player.hand_cards as CardCode[]) ?? undefined
        : undefined,
    };
  });

  const isHost = room.host_id === user?.id;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-table-felt p-4">
      <Table
        roomCode={room.room_code}
        pot={session.pot}
        communityCards={(session.community_cards as CardCode[]) ?? []}
        seats={seats}
        phase={session.phase as "WAITING" | "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN"}
        isMyTurn={session.current_turn_position === myPlayer?.seat_number && session.phase !== "WAITING"}
        mySeatNumber={myPlayer?.seat_number}
        onAction={(action, amount) => sendAction(params.code, action, amount)}
        minRaiseTo={
          session.current_bet > 0
            ? session.current_bet + (session.last_raise_size || room.big_blind)
            : room.big_blind
        }
        maxBet={myPlayer ? myPlayer.stack + myPlayer.current_bet : 0}
      />

      {session.phase === "WAITING" && isHost && players.length >= 2 && (
        <button
          onClick={() => startHand(params.code)}
          className="mt-4 rounded bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
        >
          Repartir mano
        </button>
      )}

      {session.phase === "WAITING" && isHost && players.length < 2 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Esperando jugadores... ({players.length}/{room.max_players})
        </p>
      )}

      {handHistoryEntries.length > 0 && (
        <div className="mt-6 w-full max-w-md">
          <HandHistory entry={handHistoryEntries[handHistoryEntries.length - 1] ?? null} />
        </div>
      )}
    </main>
  );
}
