import {
  board,
  thoughtInput,
  thoughts,
  editingDrafts,
  completionRemovalTimers,
  CARD_CRAFT_VARIANTS,
  COMPLETION_DISSOLVE_DURATION_MS,
  prefersReducedMotion,
  getCardCraft
} from "./state.js";
import { saveState } from "./storage.js";
import {
  disconnectCardResizeObserver,
  attachCardPointerMotion,
  observeCardSize,
  animateBoardReflow
} from "./motion.js";

let onBoardAction = null;

export const setBoardActionHandler = (handler) => {
  onBoardAction = handler;
};

const createButton = (label, action) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  return button;
};

const createEmptyState = () => {
  const wrap = document.createElement("div");
  wrap.className = "empty-state";

  const icon = document.createElement("div");
  icon.className = "empty-icon";
  icon.textContent = "💭";

  const heading = document.createElement("h2");
  heading.textContent = "Nothing here yet!";

  const message = document.createElement("p");
  message.textContent = "Drop your thoughts here. You will thank yourself later!";

  wrap.append(icon, heading, message);
  return wrap;
};

const replaceNoteCard = (card, note) => {
  disconnectCardResizeObserver(note.id);
  const replacement = createNoteCard(note);
  card.replaceWith(replacement);
  observeCardSize(replacement, note);
};

const removeCompletedNote = (noteId, card) => {
  window.clearTimeout(completionRemovalTimers.get(noteId));
  completionRemovalTimers.delete(noteId);

  const index = thoughts.findIndex((note) => note.id === noteId);
  if (index === -1) return;

  const prevPositions = prefersReducedMotion.matches
    ? undefined
    : new Map(
        Array.from(board.querySelectorAll(".card"))
          .filter((el) => el !== card)
          .map((el) => [el.dataset.noteId, el.getBoundingClientRect()])
      );

  thoughts.splice(index, 1);
  editingDrafts.delete(noteId);
  disconnectCardResizeObserver(noteId);
  card.remove();
  saveState();
  renderBoard();

  if (prevPositions) animateBoardReflow(prevPositions);
};

const completeNote = (note, card) => {
  if (card.classList.contains("is-dissolving")) return;
  onBoardAction?.();
  if (!thoughts.some((item) => item.id === note.id)) return;
  if (card.contains(document.activeElement)) thoughtInput.focus({ preventScroll: true });

  if (prefersReducedMotion.matches) {
    removeCompletedNote(note.id, card);
    return;
  }

  card.inert = true;
  card.setAttribute("aria-hidden", "true");
  card.classList.add("is-dissolving");

  const onEnd = (event) => {
    if (event.target === card && event.animationName === "card-dust-dissolve") {
      card.removeEventListener("animationend", onEnd);
      removeCompletedNote(note.id, card);
    }
  };
  card.addEventListener("animationend", onEnd);
  completionRemovalTimers.set(
    note.id,
    window.setTimeout(() => removeCompletedNote(note.id, card), COMPLETION_DISSOLVE_DURATION_MS + 100)
  );
};

export const createNoteCard = (note, shouldAnimate = false) => {
  const card = document.createElement("article");
  card.className = shouldAnimate ? "card entering" : "card";
  card.dataset.color = note.color;
  card.dataset.noteId = note.id;

  const editing = editingDrafts.has(note.id);
  if (editing) card.classList.add("is-editing");

  const craft = getCardCraft(note.id, CARD_CRAFT_VARIANTS);
  card.dataset.craft = craft.variant;
  card.style.setProperty("--note-tilt", `${craft.tilt}deg`);

  const craftLayer = document.createElement("span");
  craftLayer.className = "card-craft";
  craftLayer.setAttribute("aria-hidden", "true");

  const sheen = document.createElement("span");
  sheen.className = "card-sheen";
  craftLayer.appendChild(sheen);
  card.appendChild(craftLayer);

  attachCardPointerMotion(card);
  if (note.width !== undefined) card.style.width = `${note.width}px`;
  if (note.height !== undefined) card.style.height = `${note.height}px`;

  card.addEventListener("animationend", (event) => {
    if (event.target === card && event.animationName === "note-drop-in") {
      card.classList.remove("entering");
    }
  });

  const toolbar = document.createElement("div");
  toolbar.className = "note-toolbar";

  const completionLabel = document.createElement("label");
  completionLabel.className = "completion-control";

  const completionToggle = document.createElement("input");
  completionToggle.type = "checkbox";
  completionToggle.setAttribute("aria-label", "Done");
  completionToggle.addEventListener("change", () => {
    if (completionToggle.checked) completeNote(note, card);
  });
  completionLabel.append(completionToggle, document.createTextNode("Done"));
  toolbar.appendChild(completionLabel);

  const actions = document.createElement("div");
  actions.className = "note-actions";

  if (editing) {
    const editor = document.createElement("textarea");
    editor.className = "card-editor";
    editor.value = editingDrafts.get(note.id);
    editor.setAttribute("aria-label", "Edit note");
    editor.required = true;

    const validation = document.createElement("span");
    validation.className = "edit-validation";
    validation.setAttribute("aria-live", "polite");

    const saveButton = createButton("Save", "save");
    saveButton.disabled = editor.value.trim() === "";

    const cancelButton = createButton("Cancel", "cancel");
    cancelButton.addEventListener("click", () => {
      editingDrafts.delete(note.id);
      replaceNoteCard(card, note);
    });

    editor.addEventListener("input", () => {
      editingDrafts.set(note.id, editor.value);
      saveButton.disabled = editor.value.trim() === "";
      validation.textContent = saveButton.disabled ? "A note cannot be empty." : "";
    });

    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelButton.click();
      }
    });

    saveButton.addEventListener("click", () => {
      const updatedText = editor.value.trim();
      if (updatedText === "") {
        validation.textContent = "A note cannot be empty.";
        editor.focus();
        return;
      }
      note.text = updatedText;
      editingDrafts.delete(note.id);
      saveState();
      replaceNoteCard(card, note);
    });

    actions.append(saveButton, cancelButton);
    card.append(editor, validation);

    queueMicrotask(() => {
      if (editor.isConnected) {
        editor.focus();
        editor.setSelectionRange(editor.value.length, editor.value.length);
      }
    });
  } else {
    const text = document.createElement("p");
    text.className = "card-text";
    text.textContent = note.text;
    card.appendChild(text);

    const editButton = createButton("Edit", "edit");
    editButton.addEventListener("click", () => {
      editingDrafts.set(note.id, note.text);
      replaceNoteCard(card, note);
    });
    actions.appendChild(editButton);
  }

  const copyButton = createButton("Copy", "copy");
  copyButton.addEventListener("click", async () => {
    const feedback = card.querySelector(".copy-feedback");
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      feedback.textContent = "Copy is unavailable. Check your browser's clipboard permissions.";
      return;
    }
    try {
      await navigator.clipboard.writeText(note.text);
      feedback.textContent = "Copied to clipboard.";
    } catch {
      feedback.textContent = "Copy failed. Check clipboard permissions and try again.";
    }
  });

  actions.appendChild(copyButton);
  toolbar.appendChild(actions);

  const feedback = document.createElement("span");
  feedback.className = "copy-feedback";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");

  const footer = document.createElement("div");
  footer.className = "card-footer";
  footer.append(toolbar, feedback);
  card.appendChild(footer);

  return card;
};

export const renderBoard = (enteringNoteId) => {
  const noteIds = new Set(thoughts.map((note) => note.id));

  for (const card of board.querySelectorAll(".card")) {
    if (!noteIds.has(card.dataset.noteId)) {
      disconnectCardResizeObserver(card.dataset.noteId);
      card.remove();
    }
  }

  const renderedIds = new Set(Array.from(board.querySelectorAll(".card"), (c) => c.dataset.noteId));
  for (const item of thoughts) {
    if (!renderedIds.has(item.id)) {
      const card = createNoteCard(item, item.id === enteringNoteId);
      board.appendChild(card);
      observeCardSize(card, item);
    }
  }

  const emptyState = board.querySelector(".empty-state");
  if (thoughts.length === 0 && !emptyState) {
    board.appendChild(createEmptyState());
  } else if (thoughts.length > 0 && emptyState) {
    emptyState.remove();
  }
};