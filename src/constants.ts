export const GAME_CONFIG = {
  ROWS: 8,
  COLS: 8,
  WHITE_PLAYER: 1,
  BLACK_PLAYER: 2,
} as const;

export const CLOCK_CONFIG = {
  ENABLED: true,
  INITIAL_TIME_MS: 5 * 60 * 1000,
  TICK_INTERVAL_MS: 200,
  LOW_TIME_MS: 30 * 1000,
} as const;

export const GAME_RULES = {
  INITIAL_PIECE_ROWS: 3,
  MOVE_STEP: 1,
  JUMP_STEP: 2,

  DARK_CELL_MOD: 2,
  DARK_CELL_REMAINDER: 1,

  WHITE_DIRECTION: -1,
  BLACK_DIRECTION: 1,

  SIDES: [-1, 1],

  MEN_CAN_CAPTURE_BACKWARDS: true,

  FLYING_KINGS: true,
} as const;

export const CSS_CLASSES = {
  CELL: "cell",
  BLACK_CELL: "black-cell",
  WHITE_CELL: "white-cell",
  PIECE: "piece",
  WHITE_PIECE: "white-piece",
  BLACK_PIECE: "black-piece",
  KING: "king",
  SELECTED: "selected",
  AVAILABLE_STEP: "available-step",
  AVAILABLE_MOVE: "available-move",
  AVAILABLE_CAPTURE: "available-capture",
  CAPTURABLE: "capturable",
} as const;
