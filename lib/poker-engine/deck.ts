export type Suit = "s" | "h" | "d" | "c"; // spades, hearts, diamonds, clubs
export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T"
  | "J" | "Q" | "K" | "A";

/** Notación corta compatible con `pokersolver`, p.ej. "As", "Td", "9h". */
export type CardCode = `${Rank}${Suit}`;

const SUITS: Suit[] = ["s", "h", "d", "c"];
const RANKS: Rank[] = [
  "2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A",
];

export function createDeck(): CardCode[] {
  const deck: CardCode[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}` as CardCode);
    }
  }
  return deck;
}

/** Fisher-Yates. Usar un RNG server-side; nunca barajar en el cliente. */
export function shuffleDeck(deck: CardCode[]): CardCode[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

/**
 * Reparte `count` cartas desde el tope del mazo.
 * Devuelve las cartas repartidas y el mazo restante (inmutable).
 */
export function drawCards(
  deck: CardCode[],
  count: number
): { drawn: CardCode[]; remaining: CardCode[] } {
  if (count > deck.length) {
    throw new Error("No hay suficientes cartas en el mazo.");
  }
  return { drawn: deck.slice(0, count), remaining: deck.slice(count) };
}
