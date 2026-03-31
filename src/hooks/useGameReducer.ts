import { useReducer } from "react";
import type { GameAction } from "../logic/gameReducer";
import { createDefaultGameState, gameReducer } from "../logic/gameReducer";
import type { GameCoreState } from "../logic/persistence";

export function useGameReducer(): {
  state: GameCoreState;
  dispatch: (action: GameAction) => void;
} {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createDefaultGameState(performance.now()));
  return { state, dispatch };
}

