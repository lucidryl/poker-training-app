export interface PlayerContribution {
  playerId: string;
  /** Total apostado por el jugador en la mano (todas las rondas acumuladas). */
  totalCommitted: number;
  isFolded: boolean;
}

export interface Pot {
  amount: number;
  /** Jugadores elegibles para ganar este pozo (no retirados, con aporte suficiente). */
  eligiblePlayerIds: string[];
}

/**
 * Calcula el pozo principal y los pozos secundarios cuando hay uno o más
 * jugadores all-in con stacks distintos.
 *
 * Algoritmo: se ordenan los "niveles" de all-in y se crea un pozo por cada
 * nivel de aporte, incluyendo únicamente como elegibles a quienes contribuyeron
 * (y no se retiraron) hasta ese nivel o más.
 */
export function calculatePots(contributions: PlayerContribution[]): Pot[] {
  const nonZero = contributions.filter((c) => c.totalCommitted > 0);
  if (nonZero.length === 0) return [];

  const levels = Array.from(
    new Set(nonZero.map((c) => c.totalCommitted))
  ).sort((a, b) => a - b);

  const pots: Pot[] = [];
  let previousLevel = 0;

  for (const level of levels) {
    const layerSize = level - previousLevel;
    const contributors = nonZero.filter((c) => c.totalCommitted >= level);
    const amount = layerSize * contributors.length;

    if (amount > 0) {
      pots.push({
        amount,
        eligiblePlayerIds: contributors
          .filter((c) => !c.isFolded)
          .map((c) => c.playerId),
      });
    }

    previousLevel = level;
  }

  return pots;
}
