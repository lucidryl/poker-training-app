declare module "pokersolver" {
  interface Card {
    value: string;
    suit: string;
  }

  interface HandInstance {
    cards: Card[];
    descr: string;
    name: string;
    rank: number;
    playerId?: string;
  }

  export class Hand {
    static solve(cards: string[]): HandInstance;
    static winners(hands: HandInstance[]): HandInstance[];
  }
}
