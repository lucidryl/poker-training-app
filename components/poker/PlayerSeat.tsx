import { cn } from "@/lib/utils";
import type { TableSeat } from "./Table";

export interface PlayerSeatProps {
  seat: TableSeat;
}

export function PlayerSeat({ seat }: PlayerSeatProps) {
  if (!seat.userId) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-white/20 text-xs text-muted-foreground/40">
        Asiento {seat.seatNumber + 1}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg bg-black/40 p-2 text-xs backdrop-blur-sm",
        seat.isCurrentTurn && "animate-pulse-turn ring-2 ring-chip-gold",
        seat.isFolded && "opacity-40"
      )}
    >
      {/* Dealer chip */}
      {seat.isDealer && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-chip-gold text-[10px] font-bold text-black shadow">
          D
        </div>
      )}

      {/* Nombre */}
      <span className="font-medium text-foreground">
        {seat.username ?? "Jugador"}
      </span>

      {/* Stack */}
      <span className="text-muted-foreground">{seat.stack} fichas</span>

      {/* Apuesta */}
      {seat.currentBet > 0 && (
        <span className="rounded-full bg-chip/80 px-2 py-0.5 text-[10px] font-medium text-white">
          {seat.currentBet}
        </span>
      )}

      {/* ALL-IN */}
      {seat.isAllIn && (
        <span className="text-[10px] font-bold text-chip">ALL-IN</span>
      )}

      {/* Cartas */}
      {seat.holeCards && seat.holeCards.length > 0 && (
        <div className="mt-1 flex gap-1">
          {seat.holeCards.map((card, i) => (
            <div
              key={i}
              className="flex h-8 w-6 items-center justify-center rounded-sm bg-white text-[10px] font-bold text-black shadow"
            >
              {formatCard(card)}
            </div>
          ))}
        </div>
      )}

      {/* Cartas boca abajo (sin holeCards visibles) */}
      {(!seat.holeCards || seat.holeCards.length === 0) &&
        !seat.isFolded &&
        seat.userId && (
          <div className="mt-1 flex gap-1">
            <div className="h-8 w-6 rounded-sm bg-blue-900 shadow" />
            <div className="h-8 w-6 rounded-sm bg-blue-900 shadow" />
          </div>
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
