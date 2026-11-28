import {
  thoughtInput,
  colorPalette,
  dropBtn,
  board,
  thoughts,
  editingDrafts,
  completionRemovalTimers,
  BOARD_DATE_CHECK_INTERVAL_MS,
  getLocalDateKey,
  getActiveBoardDate,
  setActiveBoardDate,
  getSelectedColor
} from "./state.js";
import { loadState, saveState, flushResizeSave } from "./storage.js";
import { updateBoardDateHeader, disconnectCardResizeObserver } from "./motion.js";
import { renderBoard, setBoardActionHandler } from "./board.js";

let boardDateCheckIntervalId;

const checkBoardDate = () => {
  const now = new Date();
  const currentDate = getLocalDateKey(now);
  updateBoardDateHeader(now);
  if (currentDate === getActiveBoardDate()) return;

  setActiveBoardDate(currentDate);
  for (const note of thoughts) {
    window.clearTimeout(completionRemovalTimers.get(note.id));
    completionRemovalTimers.delete(note.id);
    disconnectCardResizeObserver(note.id);
  }
  thoughts.length = 0;
  editingDrafts.clear();
  board.replaceChildren();
  saveState();
  renderBoard();
};

const startBoardDateChecks = () => {
  checkBoardDate();
  if (boardDateCheckIntervalId === undefined) {
    boardDateCheckIntervalId = window.setInterval(checkBoardDate, BOARD_DATE_CHECK_INTERVAL_MS);
  }
};

const stopBoardDateChecks = () => {
  if (boardDateCheckIntervalId === undefined) return;
  window.clearInterval(boardDateCheckIntervalId);
  boardDateCheckIntervalId = undefined;
};

setBoardActionHandler(checkBoardDate);

const drop = () => {
  const cleanText = thoughtInput.value.trim();
  if (cleanText === "") return;

  checkBoardDate();
  const note = {
    id: crypto.randomUUID(),
    text: cleanText,
    color: getSelectedColor(),
    createdAt: Date.now()
  };

  thoughts.push(note);
  thoughtInput.value = "";
  saveState();
  renderBoard(note.id);
};

dropBtn.addEventListener("click", drop);

thoughtInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    drop();
  }
});

colorPalette.addEventListener("change", saveState);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkBoardDate();
});

window.addEventListener("focus", checkBoardDate);

window.addEventListener("pagehide", () => {
  stopBoardDateChecks();
  flushResizeSave();
});

window.addEventListener("pageshow", startBoardDateChecks);

loadState(updateBoardDateHeader);
renderBoard();
startBoardDateChecks();