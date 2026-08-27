export type GamePhase =
  | "WAITING"
  | "PREFLOP"
  | "FLOP"
  | "TURN"
  | "RIVER"
  | "SHOWDOWN";

export type PlayerAction = "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE";

export interface ActionLogEntry {
  playerId: string;
  action: PlayerAction;
  amount?: number;
  phase: GamePhase;
}

export interface WinnerEntry {
  playerId: string;
  username: string;
  amountWon: number;
}

export interface ShowdownHand {
  playerId: string;
  username: string;
  holeCards: string[];
  descr: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          play_chips: number;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          play_chips?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          avatar_url?: string | null;
          play_chips?: number;
          created_at?: string;
        };
      };
      rooms: {
        Row: {
          id: string;
          room_code: string;
          host_id: string;
          name: string;
          small_blind: number;
          big_blind: number;
          starting_stack: number;
          max_players: number;
          turn_time_limit: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_code: string;
          host_id: string;
          name: string;
          small_blind?: number;
          big_blind?: number;
          starting_stack?: number;
          max_players?: number;
          turn_time_limit?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_code?: string;
          host_id?: string;
          name?: string;
          small_blind?: number;
          big_blind?: number;
          starting_stack?: number;
          max_players?: number;
          turn_time_limit?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      game_sessions: {
        Row: {
          room_id: string;
          community_cards: string[];
          pot: number;
          current_bet: number;
          dealer_position: number;
          current_turn_position: number;
          phase: GamePhase;
          deck: string[];
          updated_at: string;
          last_raise_size: number;
          hand_number: number;
        };
        Insert: {
          room_id: string;
          community_cards?: string[];
          pot?: number;
          current_bet?: number;
          dealer_position?: number;
          current_turn_position?: number;
          phase?: GamePhase;
          deck?: string[];
          updated_at?: string;
          last_raise_size?: number;
          hand_number?: number;
        };
        Update: {
          room_id?: string;
          community_cards?: string[];
          pot?: number;
          current_bet?: number;
          dealer_position?: number;
          current_turn_position?: number;
          phase?: GamePhase;
          deck?: string[];
          updated_at?: string;
          last_raise_size?: number;
          hand_number?: number;
        };
      };
      room_players: {
        Row: {
          room_id: string;
          user_id: string;
          seat_number: number;
          stack: number;
          current_bet: number;
          hand_cards: string[];
          is_folded: boolean;
          is_all_in: boolean;
          acted_this_round: boolean;
          total_committed: number;
        };
        Insert: {
          room_id: string;
          user_id: string;
          seat_number: number;
          stack: number;
          current_bet?: number;
          hand_cards?: string[];
          is_folded?: boolean;
          is_all_in?: boolean;
          acted_this_round?: boolean;
          total_committed?: number;
        };
        Update: {
          room_id?: string;
          user_id?: string;
          seat_number?: number;
          stack?: number;
          current_bet?: number;
          hand_cards?: string[];
          is_folded?: boolean;
          is_all_in?: boolean;
          acted_this_round?: boolean;
          total_committed?: number;
        };
      };
      hand_history: {
        Row: {
          id: string;
          room_id: string;
          hand_number: number;
          community_cards: string[];
          pot_total: number;
          winners: WinnerEntry[];
          showdown_hands: ShowdownHand[];
          actions_log: ActionLogEntry[];
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          hand_number: number;
          community_cards?: string[];
          pot_total?: number;
          winners?: WinnerEntry[];
          showdown_hands?: ShowdownHand[];
          actions_log?: ActionLogEntry[];
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          hand_number?: number;
          community_cards?: string[];
          pot_total?: number;
          winners?: WinnerEntry[];
          showdown_hands?: ShowdownHand[];
          actions_log?: ActionLogEntry[];
          created_at?: string;
        };
      };
    };
    Views: {
      public_room_players: {
        Row: {
          room_id: string;
          user_id: string;
          seat_number: number;
          stack: number;
          current_bet: number;
          is_folded: boolean;
          is_all_in: boolean;
          hand_cards: string[];
        };
      };
    };
  };
}
