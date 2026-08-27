"use client";

import { PlayerSeat } from "./PlayerSeat";
import { BetControls } from "./BetControls";
import type { CardCode } from "@/lib/poker-engine/deck";

export interface TableSeat {
  seatNumber: number;
  userId: string | null;
  username?: string;
  stack: number;
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
  isCurrentTurn: boolean;
  holeCards?: CardCode[];
}

export interface TableProps {
  roomCode: string;
  pot: number;
  communityCards: CardCode[];
  seats: TableSeat[];
  phase: "WAITING" | "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";
  isMyTurn: boolean;
  mySeatNumber?: number;
  onAction?: (action: string, amount?: number) => void;
  minRaiseTo?: number;
  maxBet?: number;
}

export function Table({
  roomCode,
  pot,
  communityCards,
  seats,
  phase,
  isMyTurn,
  onAction,
  minRaiseTo,
  maxBet,
}: TableProps) {
  const occupiedSeats = seats.filter((s) => s.userId !== null);

  return (
    <div className="relative flex w-full max-w-3xl flex-col items-center gap-4">
      {/* Header */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Sala {roomCode}</span>
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
          {phase === "WAITING" ? "Esperando" : phase}
        </span>
      </div>

      {/* Mesa ovalada */}
      <div className="relative flex w-full flex-col items-center rounded-[40px] border-4 border-table-rail bg-table-felt px-6 py-10 shadow-2xl">
        {/* Pozo */}
        {pot > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-full bg-black/30 px-4 py-1.5">
            <span className="text-xs text-muted-foreground">Pozo</span>
            <span className="text-lg font-bold text-chip-gold">{pot}</span>
          </div>
        )}

        {/* Cartas comunitarias */}
        <div className="mb-6 flex gap-2">
          {communityCards.length === 0 && phase !== "WAITING" && (
            <p className="text-xs text-muted-foreground/60">
              Esperando cartas...
            </p>
          )}
          {communityCards.map((card, i) => (
            <div
              key={`${card}-${i}`}
              className="flex h-16 w-11 items-center justify-center rounded-md bg-white text-sm font-bold text-black shadow-md animate-deal-card"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {formatCard(card)}
            </div>
          ))}
        </div>

        {/* Asientos - Layout semicircular */}
        <div className="grid w-full grid-cols-3 gap-4">
          {seats.map((seat) => (
            <PlayerSeat key={seat.seatNumber} seat={seat} />
          ))}
        </div>
      </div>

      {/* Controles de apuesta */}
      {isMyTurn && phase !== "WAITING" && (
        <BetControls
          minRaiseTo={minRaiseTo ?? 0}
          maxBet={maxBet ?? 0}
          onAction={(action, amount) => onAction?.(action, amount)}
        />
      )}

      {/* Indicador de turno */}
      {!isMyTurn && phase !== "WAITING" && (
        <p className="text-sm text-muted-foreground">Esperando acción de otro jugador...</p>
      )}
    </div>
  );
}

function formatCard(card: string): string {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const suitSymbol: Record<string, string> = {
    s: "♠",
    h: "♥",
    d: "♦",
    c: "♣",
  };
  return `${rank}${suitSymbol[suit] ?? suit}`;
}
