import type { CardCode } from "@/lib/poker-engine/deck";

export interface HandHistoryEntry {
  handNumber: number;
  winners: { playerId: string; username: string; amountWon: number }[];
  showdownHands: { playerId: string; username: string; holeCards: string[]; descr: string }[];
  communityCards: string[];
}

export interface HandHistoryProps {
  entry: HandHistoryEntry | null;
}

export function HandHistory({ entry }: HandHistoryProps) {
  if (!entry) {
    return <p className="text-sm text-muted-foreground">Aún no hay manos jugadas.</p>;
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-4 text-sm">
      <p className="font-medium">Mano #{entry.handNumber}</p>

      {/* Ganadores */}
      <div>
        <span className="text-muted-foreground">Ganador(es): </span>
        {entry.winners
          .map((w) => `${w.username} (+${w.amountWon})`)
          .join(", ")}
      </div>

      {/* Showdown */}
      {entry.showdownHands.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-muted-foreground">Manos en showdown:</p>
          {entry.showdownHands.map((h) => (
            <div key={h.playerId} className="flex items-center gap-2 text-xs">
              <span className="font-medium">{h.username}</span>
              <span className="text-muted-foreground">{h.descr}</span>
              <div className="flex gap-0.5">
                {h.holeCards.map((card, i) => (
                  <span key={i} className="rounded bg-white px-1 text-[10px] text-black">
                    {card}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cartas comunitarias */}
      {entry.communityCards.length > 0 && (
        <div className="mt-2">
          <span className="text-xs text-muted-foreground">Board: </span>
          {entry.communityCards.map((card, i) => (
            <span key={i} className="mr-1 rounded bg-white px-1 text-xs text-black">
              {card}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
