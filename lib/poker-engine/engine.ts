/**
 * Motor del juego — orquestador central del estado de la mano.
 *
 * Este archivo contiene la lógica pura: recibe el estado actual,
 * devuelve el estado actualizado. Las rutas API se encargan de
 * persistir en Supabase.
 */
import type { GamePhase, PlayerAction, ActionLogEntry, WinnerEntry, ShowdownHand } from "@/lib/supabase/types";
import { createDeck, shuffleDeck, drawCards, type CardCode } from "./deck";
import { evaluatePlayerHand, determineWinners } from "./evaluator";
import { calculatePots, type PlayerContribution } from "./pots";
import { validateAction, nextActivePosition } from "./rules";

// ── Tipos del motor ──────────────────────────────────────────────────────────

export interface EnginePlayer {
  userId: string;
  username: string;
  seatNumber: number;
  stack: number;
  currentBet: number;
  handCards: CardCode[];
  isFolded: boolean;
  isAllIn: boolean;
  actedThisRound: boolean;
  totalCommitted: number;
}

export interface EngineGameState {
  roomId: string;
  communityCards: CardCode[];
  pot: number;
  currentBet: number;
  dealerPosition: number;
  currentTurnPosition: number;
  phase: GamePhase;
  deck: CardCode[];
  lastRaiseSize: number;
  handNumber: number;
}

export interface EngineRoomSettings {
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  maxPlayers: number;
}

export interface EngineResult {
  session: Partial<EngineGameState>;
  players: EnginePlayer[];
  handComplete: boolean;
  handHistory?: HandHistoryData;
}

export interface HandHistoryData {
  roomId: string;
  handNumber: number;
  communityCards: string[];
  potTotal: number;
  winners: WinnerEntry[];
  showdownHands: ShowdownHand[];
  actionsLog: ActionLogEntry[];
}

// ── Iniciar una mano ─────────────────────────────────────────────────────────

export function startHand(
  session: EngineGameState,
  players: EnginePlayer[],
  settings: EngineRoomSettings
): EngineResult {
  const active = players.filter((p) => p.stack > 0);
  if (active.length < 2) {
    return { session, players, handComplete: false };
  }

  const newHandNumber = session.handNumber + 1;
  const deck = shuffleDeck(createDeck());

  // Repartir cartas
  let remaining = deck;
  const updatedPlayers = players.map((p) => {
    if (p.stack <= 0) {
      return { ...p, handCards: [] as CardCode[], isFolded: true };
    }
    const { drawn, remaining: rem } = drawCards(remaining, 2);
    remaining = rem;
    return {
      ...p,
      handCards: drawn,
      isFolded: false,
      isAllIn: false,
      currentBet: 0,
      totalCommitted: 0,
      actedThisRound: false,
    };
  });

  // Posiciones de ciegas
  const seats = updatedPlayers
    .filter((p) => p.stack > 0)
    .map((p) => p.seatNumber)
    .sort((a, b) => a - b);

  const sbIndex = seats.indexOf(session.dealerPosition);
  const sbSeat = seats[(sbIndex + 1) % seats.length];
  const bbSeat = seats[(sbIndex + 2) % seats.length];
  const utgSeat = seats[(sbIndex + 3) % seats.length];

  // Post ciegas
  const sbAmount = Math.min(settings.smallBlind, updatedPlayers.find((p) => p.seatNumber === sbSeat)!.stack);
  const bbAmount = Math.min(settings.bigBlind, updatedPlayers.find((p) => p.seatNumber === bbSeat)!.stack);

  const withBlinds = updatedPlayers.map((p) => {
    if (p.seatNumber === sbSeat) {
      return {
        ...p,
        stack: p.stack - sbAmount,
        currentBet: sbAmount,
        totalCommitted: sbAmount,
        isAllIn: p.stack - sbAmount === 0,
      };
    }
    if (p.seatNumber === bbSeat) {
      return {
        ...p,
        stack: p.stack - bbAmount,
        currentBet: bbAmount,
        totalCommitted: bbAmount,
        isAllIn: p.stack - bbAmount === 0,
      };
    }
    return p;
  });

  const newSession: Partial<EngineGameState> = {
    communityCards: [],
    pot: sbAmount + bbAmount,
    currentBet: bbAmount,
    dealerPosition: session.dealerPosition,
    currentTurnPosition: utgSeat,
    phase: "PREFLOP" as GamePhase,
    deck: remaining,
    lastRaiseSize: settings.bigBlind,
    handNumber: newHandNumber,
  };

  return {
    session: newSession,
    players: withBlinds,
    handComplete: false,
  };
}

// ── Aplicar una acción ───────────────────────────────────────────────────────

export function applyAction(
  session: EngineGameState,
  players: EnginePlayer[],
  settings: EngineRoomSettings,
  userId: string,
  action: PlayerAction,
  amount?: number
): EngineResult {
  const player = players.find((p) => p.userId === userId);
  if (!player) {
    throw new Error("Jugador no encontrado en la sala.");
  }
  if (player.seatNumber !== session.currentTurnPosition) {
    throw new Error("No es tu turno.");
  }
  if (player.isFolded) {
    throw new Error("Ya te has retirado de esta mano.");
  }

  // Validar acción
  const validation = validateAction(action, amount, {
    playerStack: player.stack,
    playerCurrentBet: player.currentBet,
    tableCurrentBet: session.currentBet,
    lastRaiseSize: session.lastRaiseSize || settings.bigBlind,
    bigBlind: settings.bigBlind,
  });
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  // Aplicar acción
  let updatedPlayers = applyPlayerAction(players, userId, action, amount, session);

  // Actualizar estado de sesión según la acción
  let sessionUpdates: Partial<EngineGameState> = {};
  if (action === "BET") {
    sessionUpdates.currentBet = amount!;
    sessionUpdates.lastRaiseSize = amount!;
  } else if (action === "RAISE") {
    const prevBet = session.currentBet;
    sessionUpdates.currentBet = amount!;
    sessionUpdates.lastRaiseSize = amount! - prevBet;
    // Reset acted para todos excepto el que sube (deben responder a la nueva apuesta)
    updatedPlayers = updatedPlayers.map((p) => {
      if (p.isFolded || p.isAllIn || p.userId === userId) return p;
      return { ...p, actedThisRound: false };
    });
  }

  const actionLog: ActionLogEntry = {
    playerId: userId,
    action,
    amount,
    phase: session.phase,
  };

  // Verificar si queda solo un jugador
  const activePlayers = updatedPlayers.filter((p) => !p.isFolded);
  if (activePlayers.length === 1) {
    const result = endHandWithWinner(session, updatedPlayers, activePlayers[0]!, settings);
    result.players = updatedPlayers;
    return result;
  }

  // Verificar si la ronda de apuestas terminó
  if (isBettingRoundComplete(updatedPlayers)) {
    const mergedSession = { ...session, ...sessionUpdates };
    // Verificar si todos los jugadores restantes están all-in
    const canStillAct = updatedPlayers.filter(
      (p) => !p.isFolded && !p.isAllIn
    );
    if (canStillAct.length <= 1) {
      // Todos all-in o solo uno puede actuar: repartir calles restantes y showdown
      const result = dealRemainingAndShowdown(mergedSession, updatedPlayers, settings);
      result.players = updatedPlayers;
      return result;
    }
    // Avanzar a la siguiente calle
    const result = advanceStreet(mergedSession, updatedPlayers, settings);
    result.players = updatedPlayers;
    return result;
  }

  // Avanzar turno
  const nextTurn = findNextTurn(updatedPlayers, session.currentTurnPosition);
  return {
    session: { ...session, ...sessionUpdates, currentTurnPosition: nextTurn! },
    players: updatedPlayers,
    handComplete: false,
  };
}

// ── Funciones internas ───────────────────────────────────────────────────────

function applyPlayerAction(
  players: EnginePlayer[],
  userId: string,
  action: PlayerAction,
  amount: number | undefined,
  session: EngineGameState
): EnginePlayer[] {
  return players.map((p) => {
    if (p.userId !== userId) return p;

    switch (action) {
      case "FOLD":
        return { ...p, isFolded: true, handCards: [], actedThisRound: true };

      case "CHECK":
        return { ...p, actedThisRound: true };

      case "CALL": {
        const toCall = Math.min(
          session.currentBet - p.currentBet,
          p.stack
        );
        return {
          ...p,
          stack: p.stack - toCall,
          currentBet: p.currentBet + toCall,
          totalCommitted: p.totalCommitted + toCall,
          isAllIn: p.stack - toCall === 0,
          actedThisRound: true,
        };
      }

      case "BET": {
        const betAmt = amount!;
        return {
          ...p,
          stack: p.stack - betAmt,
          currentBet: betAmt,
          totalCommitted: p.totalCommitted + betAmt,
          isAllIn: p.stack - betAmt === 0,
          actedThisRound: true,
        };
      }

      case "RAISE": {
        const raiseTo = amount!;
        const cost = raiseTo - p.currentBet;
        return {
          ...p,
          stack: p.stack - cost,
          currentBet: raiseTo,
          totalCommitted: p.totalCommitted + cost,
          isAllIn: p.stack - cost === 0,
          actedThisRound: true,
        };
      }

      default:
        return p;
    }
  });
}



function findNextTurn(
  players: EnginePlayer[],
  fromSeat: number
): number | null {
  const positions = players
    .filter((p) => !p.isFolded)
    .map((p) => ({
      seat: p.seatNumber,
      isFolded: false,
      stack: p.stack,
    }));
  return nextActivePosition(positions, fromSeat);
}

function isBettingRoundComplete(players: EnginePlayer[]): boolean {
  const canStillAct = players.filter(
    (p) => !p.isFolded && !p.isAllIn && !p.actedThisRound
  );
  return canStillAct.length === 0;
}

function advanceStreet(
  session: EngineGameState,
  players: EnginePlayer[],
  settings: EngineRoomSettings
): EngineResult {
  const newPhase = getNextPhase(session.phase);
  let updatedCards = [...session.communityCards];
  let remaining = [...session.deck];

  if (newPhase === "FLOP") {
    const { drawn, remaining: rem } = drawCards(remaining, 3);
    updatedCards = drawn;
    remaining = rem;
  } else if (newPhase === "TURN" || newPhase === "RIVER") {
    const { drawn, remaining: rem } = drawCards(remaining, 1);
    updatedCards = [...session.communityCards, ...drawn];
    remaining = rem;
  }

  // Reset rondas de apuestas
  const updatedPlayers = players.map((p) => ({
    ...p,
    currentBet: 0,
    actedThisRound: false,
  }));

  // Encontrar primer jugador activo después del dealer
  const seats = updatedPlayers
    .filter((p) => !p.isFolded && p.stack > 0)
    .map((p) => p.seatNumber)
    .sort((a, b) => a - b);
  const dealerIdx = seats.indexOf(session.dealerPosition);
  const firstToAct = seats[(dealerIdx + 1) % seats.length];

  return {
    session: {
      communityCards: updatedCards,
      deck: remaining,
      phase: newPhase,
      currentBet: 0,
      lastRaiseSize: 0,
      currentTurnPosition: firstToAct,
    },
    players: updatedPlayers,
    handComplete: false,
  };
}

function dealRemainingAndShowdown(
  session: EngineGameState,
  players: EnginePlayer[],
  settings: EngineRoomSettings
): EngineResult {
  let remaining = [...session.deck];
  let updatedCards = [...session.communityCards];

  // Repartir las calles que faltan
  const phasesToDeal: GamePhase[] = [];
  if (session.phase === "PREFLOP") phasesToDeal.push("FLOP", "TURN", "RIVER");
  else if (session.phase === "FLOP") phasesToDeal.push("TURN", "RIVER");
  else if (session.phase === "TURN") phasesToDeal.push("RIVER");

  for (const phase of phasesToDeal) {
    const count = phase === "FLOP" ? 3 : 1;
    const { drawn, remaining: rem } = drawCards(remaining, count);
    updatedCards =
      phase === "FLOP"
        ? drawn
        : [...updatedCards, ...drawn];
    remaining = rem;
  }

  return resolveShowdown(
    { ...session, communityCards: updatedCards, deck: remaining, phase: "SHOWDOWN" },
    players,
    settings
  );
}

function endHandWithWinner(
  session: EngineGameState,
  players: EnginePlayer[],
  winner: EnginePlayer,
  settings: EngineRoomSettings
): EngineResult {
  const totalPot = players.reduce((sum, p) => sum + p.totalCommitted, 0);

  const updatedPlayers = players.map((p) =>
    p.userId === winner.userId
      ? { ...p, stack: p.stack + totalPot, totalCommitted: 0 }
      : { ...p, totalCommitted: 0 }
  );

  const handHistory: HandHistoryData = {
    roomId: session.roomId,
    handNumber: session.handNumber,
    communityCards: session.communityCards,
    potTotal: totalPot,
    winners: [
      {
        playerId: winner.userId,
        username: winner.username,
        amountWon: totalPot,
      },
    ],
    showdownHands: [],
    actionsLog: [],
  };

  // Avanzar dealer
  const activeSeats = updatedPlayers
    .filter((p) => p.stack > 0)
    .map((p) => p.seatNumber)
    .sort((a, b) => a - b);
  const nextDealer =
    activeSeats[
      (activeSeats.indexOf(session.dealerPosition) + 1) % activeSeats.length
    ];

  const resetSession: Partial<EngineGameState> = {
    communityCards: [],
    pot: 0,
    currentBet: 0,
    dealerPosition: nextDealer,
    currentTurnPosition: nextDealer,
    phase: "WAITING",
    deck: [],
    lastRaiseSize: 0,
    handNumber: session.handNumber,
  };

  const resetPlayers = updatedPlayers.map((p) => ({
    ...p,
    currentBet: 0,
    handCards: [] as CardCode[],
    isFolded: false,
    isAllIn: false,
    actedThisRound: false,
    totalCommitted: 0,
  }));

  return {
    session: resetSession,
    players: resetPlayers,
    handComplete: true,
    handHistory,
  };
}

function resolveShowdown(
  session: EngineGameState,
  players: EnginePlayer[],
  settings: EngineRoomSettings
): EngineResult {
  const remaining = players.filter((p) => !p.isFolded);

  // Evaluar manos
  const hands = remaining.map((p) =>
    evaluatePlayerHand(p.userId, p.username, p.handCards, session.communityCards)
  );

  // Calcular pozos
  const contributions: PlayerContribution[] = players.map((p) => ({
    playerId: p.userId,
    totalCommitted: p.totalCommitted,
    isFolded: p.isFolded,
  }));
  const pots = calculatePots(contributions);

  // Repartir cada pozo
  let updatedPlayers = [...players];
  const winnerEntries: WinnerEntry[] = [];

  for (const pot of pots) {
    const eligibleHands = hands.filter((h) =>
      pot.eligiblePlayerIds.includes(h.playerId)
    );
    const winnerIds = determineWinners(eligibleHands);
    const share = Math.floor(pot.amount / winnerIds.length);

    for (const winnerId of winnerIds) {
      const existing = winnerEntries.find((w) => w.playerId === winnerId);
      const player = players.find((p) => p.userId === winnerId);
      if (existing) {
        existing.amountWon += share;
      } else {
        winnerEntries.push({
          playerId: winnerId,
          username: player?.username ?? "Jugador",
          amountWon: share,
        });
      }
    }

    updatedPlayers = updatedPlayers.map((p) => {
      if (winnerIds.includes(p.userId)) {
        return { ...p, stack: p.stack + share };
      }
      return p;
    });
  }

  const showdownHands: ShowdownHand[] = hands.map((h) => ({
    playerId: h.playerId,
    username: h.username,
    holeCards: h.bestHand,
    descr: h.descr,
  }));

  const totalPot = pots.reduce((s, p) => s + p.amount, 0);

  const handHistory: HandHistoryData = {
    roomId: session.roomId,
    handNumber: session.handNumber,
    communityCards: session.communityCards,
    potTotal: totalPot,
    winners: winnerEntries,
    showdownHands,
    actionsLog: [],
  };

  // Revelar cartas de todos los jugadores que llegaron a showdown
  const revealedPlayers = updatedPlayers.map((p) => {
    if (showdownHands.some((h) => h.playerId === p.userId)) {
      const hand = hands.find((h) => h.playerId === p.userId);
      return { ...p, handCards: hand?.bestHand ?? p.handCards };
    }
    return p;
  });

  // Avanzar dealer
  const activeSeats = revealedPlayers
    .filter((p) => p.stack > 0)
    .map((p) => p.seatNumber)
    .sort((a, b) => a - b);
  const nextDealer =
    activeSeats[
      (activeSeats.indexOf(session.dealerPosition) + 1) % activeSeats.length
    ];

  const resetSession: Partial<EngineGameState> = {
    communityCards: [],
    pot: 0,
    currentBet: 0,
    dealerPosition: nextDealer,
    currentTurnPosition: nextDealer,
    phase: "WAITING",
    deck: [],
    lastRaiseSize: 0,
    handNumber: session.handNumber,
  };

  const resetPlayers = revealedPlayers.map((p) => ({
    ...p,
    currentBet: 0,
    handCards: [] as CardCode[],
    isFolded: false,
    isAllIn: false,
    actedThisRound: false,
    totalCommitted: 0,
  }));

  return {
    session: resetSession,
    players: resetPlayers,
    handComplete: true,
    handHistory,
  };
}

function getNextPhase(current: GamePhase): GamePhase {
  const order: GamePhase[] = ["PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"];
  const idx = order.indexOf(current);
  return order[Math.min(idx + 1, order.length - 1)]!;
}
