import {
  colorPalette,
  storageStatus,
  thoughts,
  STORAGE_KEY,
  STORAGE_VERSION,
  LEGACY_NOTE_LIFESPAN_MS,
  RESIZE_SAVE_DEBOUNCE_MS,
  NOTE_COLORS,
  getActiveBoardDate,
  getSelectedColor
} from "./state.js";

let resizeSaveTimerId;

const setStorageStatus = (message) => {
  storageStatus.textContent = message;
  storageStatus.hidden = message === "";
};

const isInRange = (value, min, max) =>
  value === undefined || (Number.isSafeInteger(value) && value >= min && value <= max);

const isValidStoredNote = (note, version) =>
  note &&
  typeof note === "object" &&
  !Array.isArray(note) &&
  typeof note.id === "string" &&
  note.id.length > 0 &&
  typeof note.text === "string" &&
  note.text.trim().length > 0 &&
  NOTE_COLORS.has(note.color) &&
  Number.isSafeInteger(note.createdAt) &&
  (version === 1
    ? Number.isSafeInteger(note.expiresAt) &&
      note.expiresAt === note.createdAt + LEGACY_NOTE_LIFESPAN_MS &&
      (note.completed === undefined || typeof note.completed === "boolean")
    : note.expiresAt === undefined && note.completed === undefined) &&
  isInRange(note.width, 80, 2000) &&
  isInRange(note.height, 100, 1600);

const isValidStoredState = (state) => {
  if (
    !state ||
    typeof state !== "object" ||
    Array.isArray(state) ||
    (state.version !== 1 && state.version !== STORAGE_VERSION) ||
    !Array.isArray(state.notes) ||
    !NOTE_COLORS.has(state.selectedColor) ||
    !state.notes.every((note) => isValidStoredNote(note, state.version)) ||
    (state.version === STORAGE_VERSION && !/^\d{4}-\d{2}-\d{2}$/.test(state.boardDate))
  ) {
    return false;
  }

  const ids = state.notes.map((note) => note.id);
  return new Set(ids).size === ids.length;
};

export const saveState = () => {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        boardDate: getActiveBoardDate(),
        notes: thoughts,
        selectedColor: getSelectedColor()
      })
    );
    setStorageStatus("");
  } catch {
    setStorageStatus("Couldn't save changes; browser storage may be full or unavailable.");
  }
};

const resetInvalidStorage = (message) => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    message += " Browser storage could not be cleared.";
  }
  saveState();
  setStorageStatus(message);
};

export const loadState = (onDateHeaderUpdate) => {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    setStorageStatus("Browser storage is unavailable; notes may not persist.");
    return;
  }

  if (raw === null) {
    onDateHeaderUpdate?.();
    saveState();
    return;
  }

  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    resetInvalidStorage("Saved notes were unreadable and have been cleared.");
    return;
  }

  if (!isValidStoredState(state)) {
    resetInvalidStorage("Saved notes were invalid and have been cleared.");
    return;
  }

  colorPalette.querySelector(`input[name="note-color"][value="${state.selectedColor}"]`).checked = true;

  if (state.version === STORAGE_VERSION && state.boardDate !== getActiveBoardDate()) {
    saveState();
    onDateHeaderUpdate?.();
    return;
  }

  let migrated = state.version !== STORAGE_VERSION;
  for (const note of state.notes) {
    if (state.version === 1) {
      if (note.completed === true) {
        migrated = true;
        continue;
      }
      const { completed: _c, expiresAt: _e, ...cleanNote } = note;
      thoughts.push(cleanNote);
    } else {
      thoughts.push(note);
    }
  }

  if (migrated) saveState();
  onDateHeaderUpdate?.();
};

export const scheduleResizeSave = () => {
  window.clearTimeout(resizeSaveTimerId);
  resizeSaveTimerId = window.setTimeout(() => {
    resizeSaveTimerId = undefined;
    saveState();
  }, RESIZE_SAVE_DEBOUNCE_MS);
};

export const flushResizeSave = () => {
  if (resizeSaveTimerId === undefined) return;
  window.clearTimeout(resizeSaveTimerId);
  resizeSaveTimerId = undefined;
  saveState();
};