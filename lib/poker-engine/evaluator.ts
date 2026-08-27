// @ts-ignore - `pokersolver` no incluye tipos oficiales.
import { Hand } from "pokersolver";
import type { CardCode } from "./deck";

export interface HandResult {
  playerId: string;
  username: string;
  /** Nombre de la jugada, p.ej. "Full House", "Two Pair". */
  descr: string;
  /** Las 5 cartas que conforman la mejor jugada. */
  bestHand: CardCode[];
}

/**
 * Evalúa la mejor mano de 5 cartas de un jugador combinando sus 2 cartas
 * privadas + las cartas comunitarias disponibles (3, 4 ó 5).
 */
export function evaluatePlayerHand(
  playerId: string,
  username: string,
  holeCards: CardCode[],
  communityCards: CardCode[]
): HandResult {
  const allCards = [...holeCards, ...communityCards];
  const solved = Hand.solve(allCards);
  return {
    playerId,
    username,
    descr: solved.descr,
    bestHand: solved.cards.map(
      (c: { value: string; suit: string }) =>
        `${c.value}${c.suit}` as CardCode
    ),
  };
}

/**
 * Determina el/los ganador(es) entre varias manos evaluadas.
 * Reconstruye instancias `Hand` para reutilizar `Hand.winners()` de pokersolver
 * y así heredar su lógica completa de desempate/kickers.
 */
export function determineWinners(hands: HandResult[]): string[] {
  if (hands.length === 0) return [];
  if (hands.length === 1) return [hands[0]!.playerId];

  // Reconstruir instancias Hand para cada jugador
  const solvedHands = hands.map((h) => {
    const handObj = Hand.solve(h.bestHand);
    // Inyectar el playerId para poder mapear de vuelta
    handObj.playerId = h.playerId;
    return handObj;
  });

  // Hand.winners() devuelve un array de las manos ganadoras (en empate,
  // devuelve todas las manos con el mismo rango/kicker)
  const winners = Hand.winners(solvedHands);
  return winners.map((w) => String(w.playerId));
}
