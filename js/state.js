export const thoughtInput = document.getElementById("thought-input");
export const colorPalette = document.getElementById("color-palette");
export const dropBtn = document.getElementById("drop-btn");
export const board = document.getElementById("board");
export const boardDateLabel = document.getElementById("board-date");
export const storageStatus = document.getElementById("storage-status");

export const BOARD_DATE_CHECK_INTERVAL_MS = 30 * 1000;
export const LEGACY_NOTE_LIFESPAN_MS = 24 * 60 * 60 * 1000;
export const COMPLETION_DISSOLVE_DURATION_MS = 650;
export const BOARD_REFLOW_DURATION_MS = 320;
export const RESIZE_SAVE_DEBOUNCE_MS = 180;
export const STORAGE_KEY = "float.state.v1";
export const STORAGE_VERSION = 2;
export const NOTE_COLORS = new Set(["yellow", "lavender", "blue", "mint", "peach", "rose"]);
export const CARD_CRAFT_VARIANTS = ["deckle", "dogear", "pocket", "tilt"];

export const thoughts = [];
export const editingDrafts = new Map();
export const completionRemovalTimers = new Map();
export const cardResizeObservers = new Map();
export const cardMotionResetters = new WeakMap();
export const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
export const boardDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric"
});

export const getLocalDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

let activeBoardDate = getLocalDateKey();

export const getActiveBoardDate = () => activeBoardDate;
export const setActiveBoardDate = (nextDate) => {
  activeBoardDate = nextDate;
};

export const getSelectedColor = () =>
  colorPalette.querySelector('input[name="note-color"]:checked').value;

export const getCardCraft = (noteId, variants = CARD_CRAFT_VARIANTS) => {
  let hash = 2166136261;
  for (let i = 0; i < noteId.length; i += 1) {
    hash = Math.imul(hash ^ noteId.charCodeAt(i), 16777619);
  }
  const h = hash >>> 0;
  return {
    variant: variants[h % variants.length],
    tilt: ((h >>> 8) % 18 - 8) / 10
  };
};