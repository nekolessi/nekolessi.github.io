import {
  PROFILE_REACTIONS,
  REACTION_EMOJI_BY_ID,
  REACTION_LOCAL_KEY,
  REACTIONS_WORKER_URL,
  UI_TEXT,
  VIEW_FETCH_TIMEOUT_MS,
  defaultReactionCounts,
  normalizeReactionCounts,
} from "./config.js";
import { withTimeout } from "./helpers.js";

function readStoredReactionChoice(localStorageImpl) {
  try {
    const value = localStorageImpl.getItem(REACTION_LOCAL_KEY) || "";
    return PROFILE_REACTIONS.some((reaction) => reaction.id === value)
      ? value
      : "";
  } catch {
    return "";
  }
}

function storeReactionChoice(localStorageImpl, reactionId) {
  try {
    localStorageImpl.setItem(REACTION_LOCAL_KEY, reactionId);
  } catch {
    // Ignore storage failures.
  }
}

export function createReactionsController({
  elements,
  fetchImpl,
  localStorageImpl,
}) {
  let reactionsFetchInFlight = false;
  let selectedReactionId = readStoredReactionChoice(localStorageImpl);
  let reactionCounts = defaultReactionCounts();

  function setReactionStatus(message) {
    if (!elements.reactionStatus) {
      return;
    }

    elements.reactionStatus.textContent = message || "";
  }

  function renderReactionButtons(counts = reactionCounts) {
    if (!elements.profileReactionsRoot) {
      return;
    }

    reactionCounts = normalizeReactionCounts(counts);
    elements.profileReactionsRoot.innerHTML = "";

    PROFILE_REACTIONS.forEach((reaction) => {
      const button = elements.documentRef.createElement("button");
      button.type = "button";
      button.className = "reaction-btn";
      if (selectedReactionId === reaction.id) {
        button.classList.add("active");
      }

      button.setAttribute(
        "aria-pressed",
        selectedReactionId === reaction.id ? "true" : "false",
      );
      button.setAttribute("aria-label", `${reaction.label} reaction`);
      button.disabled = reactionsFetchInFlight;

      const emoji = elements.documentRef.createElement("span");
      emoji.className = "reaction-emoji";
      emoji.textContent = REACTION_EMOJI_BY_ID[reaction.id] || reaction.emoji;

      const count = elements.documentRef.createElement("span");
      count.className = "reaction-count";
      count.textContent = String(reactionCounts[reaction.id] ?? 0);

      button.appendChild(emoji);
      button.appendChild(count);
      button.addEventListener("click", () => {
        void submitReaction(reaction.id);
      });

      elements.profileReactionsRoot.appendChild(button);
    });
  }

  async function fetchReactionCounts() {
    const response = await withTimeout(
      fetchImpl(REACTIONS_WORKER_URL, {
        cache: "no-store",
      }),
      VIEW_FETCH_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Reaction request failed (${response.status})`);
    }

    const payload = await response.json();
    return normalizeReactionCounts(payload?.counts);
  }

  async function submitReaction(reactionId) {
    if (
      !REACTIONS_WORKER_URL ||
      reactionsFetchInFlight ||
      !elements.profileReactionsRoot
    ) {
      return;
    }

    reactionsFetchInFlight = true;
    renderReactionButtons();
    setReactionStatus("");

    try {
      const response = await withTimeout(
        fetchImpl(REACTIONS_WORKER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reaction: reactionId }),
        }),
        VIEW_FETCH_TIMEOUT_MS,
      );

      if (!response.ok) {
        throw new Error(`Reaction update failed (${response.status})`);
      }

      const payload = await response.json();
      selectedReactionId = reactionId;
      storeReactionChoice(localStorageImpl, reactionId);
      renderReactionButtons(normalizeReactionCounts(payload?.counts));
      setReactionStatus(UI_TEXT.reactionSaved);
    } catch {
      setReactionStatus(UI_TEXT.reactionSaveFailed);
      try {
        renderReactionButtons(await fetchReactionCounts());
      } catch {
        renderReactionButtons();
      }
    } finally {
      reactionsFetchInFlight = false;
      renderReactionButtons();
    }
  }

  async function init() {
    if (!elements.reactionsSection || !elements.profileReactionsRoot) {
      return;
    }

    if (!REACTIONS_WORKER_URL) {
      elements.reactionsSection.style.display = "none";
      return;
    }

    renderReactionButtons();
    setReactionStatus("");

    try {
      renderReactionButtons(await fetchReactionCounts());
    } catch {
      setReactionStatus(UI_TEXT.reactionsOffline);
    }
  }

  return {
    init,
    renderReactionButtons,
    setReactionStatus,
  };
}
