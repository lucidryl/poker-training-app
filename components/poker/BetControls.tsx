"use client";

import { useState } from "react";
import type { PlayerAction } from "@/lib/poker-engine/rules";

export interface BetControlsProps {
  minRaiseTo?: number;
  maxBet?: number;
  onAction?: (action: PlayerAction, amount?: number) => void;
}

export function BetControls({
  minRaiseTo = 0,
  maxBet = 0,
  onAction,
}: BetControlsProps) {
  const [raiseAmount, setRaiseAmount] = useState(minRaiseTo);

  const handleRaise = () => {
    onAction?.("RAISE", raiseAmount);
  };

  const handleBet = () => {
    onAction?.("BET", raiseAmount);
  };

  const isRaiseMode = minRaiseTo > 0;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/80 px-4 py-3 backdrop-blur-sm">
      <button
        onClick={() => onAction?.("FOLD")}
        className="rounded bg-destructive px-4 py-2 text-sm font-medium text-destruct-foreground hover:opacity-90"
      >
        Retirarse
      </button>

      <button
        onClick={() => onAction?.("CHECK")}
        className="rounded bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
      >
        Pasar
      </button>

      <button
        onClick={() => onAction?.("CALL")}
        className="rounded bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
      >
        Igualar
      </button>

      {maxBet > 0 && (
        <>
          <input
            type="range"
            min={minRaiseTo}
            max={maxBet}
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="w-24 accent-primary"
          />
          <button
            onClick={isRaiseMode ? handleRaise : handleBet}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {isRaiseMode ? `Subir a ${raiseAmount}` : `Apostar ${raiseAmount}`}
          </button>
        </>
      )}
    </div>
  );
}
