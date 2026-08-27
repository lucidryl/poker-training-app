export type PlayerAction = "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE";

export interface ActionContext {
  playerStack: number;
  playerCurrentBet: number;
  /** Apuesta más alta activa en la ronda actual. */
  tableCurrentBet: number;
  /** Tamaño de la última subida (para exigir subida mínima igual o mayor). */
  lastRaiseSize: number;
  bigBlind: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Valida una acción propuesta contra el estado actual de la ronda de apuestas. */
export function validateAction(
  action: PlayerAction,
  amount: number | undefined,
  ctx: ActionContext
): ValidationResult {
  const toCall = ctx.tableCurrentBet - ctx.playerCurrentBet;

  switch (action) {
    case "FOLD":
      return { valid: true };

    case "CHECK":
      if (toCall > 0) {
        return { valid: false, reason: "No se puede pasar: hay una apuesta activa." };
      }
      return { valid: true };

    case "CALL":
      if (toCall <= 0) {
        return { valid: false, reason: "No hay apuesta que igualar." };
      }
      return { valid: true };

    case "BET": {
      if (ctx.tableCurrentBet > 0) {
        return { valid: false, reason: "Ya existe una apuesta; usa RAISE." };
      }
      const minBet = ctx.bigBlind;
      if (!amount || amount < Math.min(minBet, ctx.playerStack)) {
        return { valid: false, reason: `La apuesta mínima es ${minBet}.` };
      }
      return { valid: true };
    }

    case "RAISE": {
      if (ctx.tableCurrentBet === 0) {
        return { valid: false, reason: "No hay apuesta previa; usa BET." };
      }
      const minRaiseTo = ctx.tableCurrentBet + (ctx.lastRaiseSize || ctx.bigBlind);
      const isAllIn = amount === ctx.playerStack + ctx.playerCurrentBet;
      if (!amount || (amount < minRaiseTo && !isAllIn)) {
        return {
          valid: false,
          reason: `La subida mínima es hasta ${minRaiseTo} (o all-in si el stack es menor).`,
        };
      }
      return { valid: true };
    }

    default:
      return { valid: false, reason: "Acción desconocida." };
  }
}

/** Determina las siguientes posiciones activas (no fold, con stack > 0) a partir de una posición dada. */
export function nextActivePosition(
  positions: { seat: number; isFolded: boolean; stack: number }[],
  fromSeat: number
): number | null {
  const active = positions.filter((p) => !p.isFolded && p.stack > 0);
  if (active.length === 0) return null;

  const sortedSeats = positions.map((p) => p.seat).sort((a, b) => a - b);
  const startIdx = sortedSeats.indexOf(fromSeat);

  for (let i = 1; i <= sortedSeats.length; i++) {
    const seat = sortedSeats[(startIdx + i) % sortedSeats.length]!;
    const player = positions.find((p) => p.seat === seat);
    if (player && !player.isFolded && player.stack > 0) return seat;
  }
  return null;
}
