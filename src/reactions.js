import {
  PROFILE_REACTIONS,
  REACTION_COUNTS_LOCAL_KEY,
  REACTION_EMOJI_BY_ID,
  REACTION_FEEDBACK,
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

function readStoredReactionCounts(localStorageImpl) {
  try {
    const raw = localStorageImpl.getItem(REACTION_COUNTS_LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function storeReactionCounts(localStorageImpl, counts) {
  try {
    localStorageImpl.setItem(REACTION_COUNTS_LOCAL_KEY, JSON.stringify(counts));
  } catch {
    // Ignore storage failures.
  }
}

function mergeCounts(baseCounts, localExtra) {
  const merged = { ...baseCounts };
  if (localExtra && typeof localExtra === "object") {
    Object.entries(localExtra).forEach(([id, count]) => {
      if (typeof count === "number" && count > (merged[id] || 0)) {
        merged[id] = count;
      }
    });
  }
  return normalizeReactionCounts(merged);
}

function formatRateLimitMessage(retryAfterMs) {
  const retrySeconds = Math.max(
    1,
    Math.ceil(Number.parseInt(retryAfterMs, 10) / 1000 || 0),
  );
  return `Please wait ${retrySeconds}s before reacting again.`;
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

      const label = elements.documentRef.createElement("span");
      label.className = "reaction-label";
      label.textContent = reaction.label;

      const count = elements.documentRef.createElement("span");
      count.className = "reaction-count";
      count.textContent = String(reactionCounts[reaction.id] ?? 0);

      button.appendChild(emoji);
      button.appendChild(label);
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
    const localExtra = readStoredReactionCounts(localStorageImpl);
    return mergeCounts(payload?.counts, localExtra);
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
        let errorMessage = "";
        try {
          const payload = await response.json();
          if (response.status === 429) {
            errorMessage = formatRateLimitMessage(payload?.retryAfterMs);
            throw new Error(errorMessage);
          }

          if (
            response.status === 400 &&
            payload?.error === "Invalid reaction type"
          ) {
            selectedReactionId = reactionId;
            storeReactionChoice(localStorageImpl, reactionId);
            const currentCounts = { ...reactionCounts };
            currentCounts[reactionId] = (currentCounts[reactionId] || 0) + 1;
            storeReactionCounts(localStorageImpl, currentCounts);
            renderReactionButtons(currentCounts);
            const feedbackText =
              REACTION_FEEDBACK[reactionId] || UI_TEXT.reactionSaved;
            setReactionStatus(feedbackText);
            return;
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.startsWith("Please wait ")
          ) {
            throw error;
          }
        }

        throw new Error(
          errorMessage || `Reaction update failed (${response.status})`,
        );
      }

      const payload = await response.json();
      selectedReactionId = reactionId;
      storeReactionChoice(localStorageImpl, reactionId);
      const localExtra = readStoredReactionCounts(localStorageImpl);
      const mergedCounts = mergeCounts(payload?.counts, localExtra);
      storeReactionCounts(localStorageImpl, mergedCounts);
      renderReactionButtons(mergedCounts);
      const feedbackText =
        REACTION_FEEDBACK[reactionId] || UI_TEXT.reactionSaved;
      setReactionStatus(feedbackText);
    } catch (error) {
      setReactionStatus(
        error instanceof Error && error.message.startsWith("Please wait ")
          ? error.message
          : UI_TEXT.reactionSaveFailed,
      );
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
