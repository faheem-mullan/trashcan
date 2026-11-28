import {
  board,
  boardDateLabel,
  cardResizeObservers,
  cardMotionResetters,
  prefersReducedMotion,
  boardDateFormatter,
  BOARD_REFLOW_DURATION_MS,
  getActiveBoardDate
} from "./state.js";
import { scheduleResizeSave } from "./storage.js";

export const updateBoardDateHeader = (date = new Date()) => {
  if (!boardDateLabel) return;
  boardDateLabel.dateTime = getActiveBoardDate();
  boardDateLabel.textContent = boardDateFormatter.format(date);
};

export const getNoteCard = (noteId) =>
  Array.from(board.querySelectorAll(".card")).find((card) => card.dataset.noteId === noteId);

export const disconnectCardResizeObserver = (noteId) => {
  const reg = cardResizeObservers.get(noteId);
  if (!reg) return;
  cardMotionResetters.get(reg.card)?.();
  reg.observer.disconnect();
  reg.card.removeEventListener("pointerdown", reg.onPointerDown);
  window.removeEventListener("pointerup", reg.onPointerEnd);
  window.removeEventListener("pointercancel", reg.onPointerEnd);
  cardResizeObservers.delete(noteId);
};

export const attachCardPointerMotion = (card) => {
  let frameId;
  let pointer;

  const reset = () => {
    if (frameId !== undefined) {
      window.cancelAnimationFrame(frameId);
      frameId = undefined;
    }
    pointer = undefined;
    card.classList.remove("is-pointer-moving");
    card.style.removeProperty("--pointer-x");
    card.style.removeProperty("--pointer-y");
    card.style.removeProperty("--pointer-tilt-x");
    card.style.removeProperty("--pointer-tilt-y");
  };

  const onPointerMove = (event) => {
    if (
      prefersReducedMotion.matches ||
      event.pointerType === "touch" ||
      card.classList.contains("is-resizing") ||
      card.classList.contains("is-editing") ||
      card.classList.contains("entering") ||
      (event.target instanceof Element && event.target.closest(".card-footer"))
    ) {
      if (prefersReducedMotion.matches) reset();
      return;
    }

    pointer = { x: event.clientX, y: event.clientY };
    if (frameId !== undefined) return;

    frameId = window.requestAnimationFrame(() => {
      frameId = undefined;
      if (!pointer || card.classList.contains("is-resizing")) return reset();
      const bounds = card.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return reset();

      const px = Math.max(0, Math.min(1, (pointer.x - bounds.left) / bounds.width));
      const py = Math.max(0, Math.min(1, (pointer.y - bounds.top) / bounds.height));
      card.style.setProperty("--pointer-x", `${(px * 100).toFixed(1)}%`);
      card.style.setProperty("--pointer-y", `${(py * 100).toFixed(1)}%`);
      card.style.setProperty("--pointer-tilt-x", `${((0.5 - py) * 1.8).toFixed(2)}deg`);
      card.style.setProperty("--pointer-tilt-y", `${((px - 0.5) * 1.8).toFixed(2)}deg`);
      card.classList.add("is-pointer-moving");
    });
  };

  card.addEventListener("pointermove", onPointerMove);
  card.addEventListener("pointerleave", reset);
  card.addEventListener("pointercancel", reset);
  cardMotionResetters.set(card, reset);
};

export const observeCardSize = (card, note) => {
  if (typeof ResizeObserver === "undefined") return;

  let initial = true;
  let resizing = false;

  const saveSize = () => {
    const { offsetWidth: width, offsetHeight: height } = card;
    if (note.width === width && note.height === height) return;
    note.width = width;
    note.height = height;
    scheduleResizeSave();
  };

  const onPointerDown = (event) => {
    const bounds = card.getBoundingClientRect();
    resizing = event.clientX >= bounds.right - 24 && event.clientY >= bounds.bottom - 24;
    if (resizing) {
      card.classList.add("is-resizing");
      cardMotionResetters.get(card)?.();
    }
  };

  const onPointerEnd = () => {
    if (!resizing) return;
    resizing = false;
    card.classList.remove("is-resizing");
    window.requestAnimationFrame(() => window.requestAnimationFrame(saveSize));
  };

  const observer = new ResizeObserver(() => {
    if (initial) {
      initial = false;
      return;
    }
    if (resizing) saveSize();
  });

  card.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", onPointerEnd);
  observer.observe(card);
  cardResizeObservers.set(note.id, { card, observer, onPointerDown, onPointerEnd });
};

export const animateBoardReflow = (previousPositions) => {
  if (prefersReducedMotion.matches) return;

  for (const [noteId, prev] of previousPositions) {
    const card = getNoteCard(noteId);
    if (!card) continue;
    const next = card.getBoundingClientRect();
    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

    const finalTransform = window.getComputedStyle(card).transform;
    const startTransform =
      finalTransform === "none" ? `translate(${dx}px, ${dy}px)` : `translate(${dx}px, ${dy}px) ${finalTransform}`;
    card.animate([{ transform: startTransform }, { transform: finalTransform }], {
      duration: BOARD_REFLOW_DURATION_MS,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
    });
  }
};