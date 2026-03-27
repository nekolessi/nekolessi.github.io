import {
  APP_CONFIG,
  DEFAULT_ACTIVITY_ART,
  DEFAULT_STATUS_AVATAR,
  DISCORD_APP_WORKER_URL,
  UI_TEXT,
  VIEW_FETCH_TIMEOUT_MS,
} from "./config.js";
import {
  customEmojiUrl,
  formatMs,
  resolveSpotifyArtUrl,
  withTimeout,
} from "./helpers.js";

function isUserIdSet() {
  return /^\d{17,20}$/.test(APP_CONFIG.discordUserId);
}

function isDocumentHidden(documentRef) {
  return typeof documentRef?.hidden === "boolean" && documentRef.hidden;
}

function activityImageFromDiscord(activity) {
  if (!activity || !activity.assets) {
    return "";
  }

  const largeImage =
    activity.assets.large_image || activity.assets.small_image || "";
  if (!largeImage) {
    return "";
  }

  if (largeImage.startsWith("http://") || largeImage.startsWith("https://")) {
    return largeImage;
  }

  if (largeImage.startsWith("mp:")) {
    return `https://media.discordapp.net/${largeImage.slice(3)}`;
  }

  if (largeImage.startsWith("spotify:")) {
    return resolveSpotifyArtUrl(largeImage.slice("spotify:".length));
  }

  if (!activity.application_id) {
    return "";
  }

  return `https://cdn.discordapp.com/app-assets/${activity.application_id}/${largeImage}.png?size=256`;
}

function activityDisplayScore(activity) {
  if (!activity || activity.type === 4 || !activity.name) {
    return -1;
  }

  const name = activity.name.trim().toLowerCase();
  const hasLargeImage = Boolean(activity.assets?.large_image);
  const hasSmallImage = Boolean(activity.assets?.small_image);
  const hasDetails = Boolean((activity.details || activity.state || "").trim());
  const hasTimestamps = Boolean(
    activity.timestamps?.start || activity.timestamps?.end,
  );
  const isDiscordHostedActivity = [
    "discord",
    "on-together",
    "watch together",
    "youtube",
    "poker night",
  ].includes(name);

  let score = 0;
  if (hasLargeImage) {
    score += 5;
  }

  if (hasSmallImage) {
    score += 2;
  }

  if (hasDetails) {
    score += 3;
  }

  if (hasTimestamps) {
    score += 1;
  }

  if (activity.application_id) {
    score += 1;
  }

  if (isDiscordHostedActivity) {
    score -= 4;
  }

  return score;
}

function pickRichActivity(activities) {
  if (!Array.isArray(activities)) {
    return null;
  }

  const candidates = activities.filter(
    (activity) => activity.type !== 4 && activity.name,
  );
  if (!candidates.length) {
    return null;
  }

  return candidates.reduce((best, current) =>
    activityDisplayScore(current) > activityDisplayScore(best) ? current : best,
  );
}

export function createPresenceController({
  elements,
  documentRef,
  fetchImpl,
  setIntervalImpl,
  clearIntervalImpl,
  nowFn = Date.now,
}) {
  const hasPresenceElements = Boolean(
    elements.statusLink &&
    elements.statusAvatar &&
    elements.discordName &&
    elements.statusDot &&
    elements.statusText &&
    elements.activityArt &&
    elements.activityTitle &&
    elements.activitySubtitle &&
    elements.timeline &&
    elements.currentTime &&
    elements.totalTime &&
    elements.progressFill,
  );

  let presenceFetchInFlight = false;
  let progressState = null;
  let progressTimer = null;
  let refreshTimer = null;
  let visibilityHandler = null;
  const discordApplicationIconCache = new Map();

  function setStatusDot(status) {
    if (!elements.statusDot) {
      return;
    }

    elements.statusDot.classList.remove(
      "online",
      "idle",
      "dnd",
      "offline",
      "streaming",
    );
    elements.statusDot.classList.add(status || "offline");
  }

  function setStatusText(customStatus, fallbackText) {
    if (!elements.statusText) {
      return;
    }

    const fallback = fallbackText || "Offline";
    elements.statusText.textContent = "";

    const statusState = String(customStatus?.state || "").trim();
    const emoji = customStatus?.emoji;
    const emojiUrl = customEmojiUrl(emoji);

    if (!statusState && !emoji && !emojiUrl) {
      elements.statusText.textContent = fallback;
      return;
    }

    const wrapper = documentRef.createElement("span");
    wrapper.className = "status-text-content";

    if (emojiUrl) {
      const img = documentRef.createElement("img");
      img.className = "status-emoji";
      img.src = emojiUrl;
      img.alt = emoji?.name || "status emoji";
      wrapper.appendChild(img);
    } else if (emoji?.name) {
      const emojiSpan = documentRef.createElement("span");
      emojiSpan.className = "status-emoji status-emoji-unicode";
      emojiSpan.textContent = emoji.name;
      wrapper.appendChild(emojiSpan);
    }

    if (statusState) {
      const textNode = documentRef.createElement("span");
      textNode.textContent = statusState;
      wrapper.appendChild(textNode);
    }

    elements.statusText.appendChild(wrapper);
  }

  function setActivitySubtitle(text) {
    if (!elements.activitySubtitle) {
      return;
    }

    const safeText = String(text || "").trim();
    elements.activitySubtitle.textContent = safeText;
    elements.activitySubtitle.hidden = !safeText;
  }

  function setActivityArt(imageUrl, label) {
    if (!elements.activityArt) {
      return;
    }

    elements.activityArt.src = imageUrl || DEFAULT_ACTIVITY_ART;
    elements.activityArt.alt = label ? `${label} artwork` : "Activity artwork";
  }

  function stopProgress() {
    progressState = null;
    if (progressTimer) {
      clearIntervalImpl(progressTimer);
      progressTimer = null;
    }

    elements.timeline.classList.add("hidden");
    elements.timeline.classList.remove("elapsed-only");
    elements.progressFill.style.width = "0%";
    elements.currentTime.textContent = "0:00";
    elements.totalTime.textContent = "0:00";
  }

  function startProgress(startMs, endMs) {
    stopProgress();

    if (!startMs) {
      elements.timeline.classList.add("hidden");
      return;
    }

    const isElapsedOnly = !endMs || endMs <= startMs;
    progressState = {
      startMs,
      endMs: isElapsedOnly ? null : endMs,
      isElapsedOnly,
    };
    elements.timeline.classList.remove("hidden");
    elements.timeline.classList.toggle("elapsed-only", isElapsedOnly);

    const tick = () => {
      if (!progressState) {
        return;
      }

      const elapsed = Math.max(nowFn() - progressState.startMs, 0);
      elements.currentTime.textContent = formatMs(elapsed);

      if (progressState.isElapsedOnly) {
        elements.totalTime.textContent = "elapsed";
        elements.progressFill.style.width = "100%";
        return;
      }

      const duration = progressState.endMs - progressState.startMs;
      const clampedElapsed = Math.min(elapsed, duration);
      const percent = Math.min((clampedElapsed / duration) * 100, 100);

      elements.currentTime.textContent = formatMs(clampedElapsed);
      elements.totalTime.textContent = formatMs(duration);
      elements.progressFill.style.width = `${percent}%`;
    };

    tick();
    progressTimer = setIntervalImpl(tick, 1000);
  }

  function setDiscordProfileLink(userId, label = "") {
    if (!elements.statusLink) {
      return;
    }

    const safeId = String(userId || "").trim();
    if (!safeId) {
      elements.statusLink.removeAttribute("href");
      elements.statusLink.classList.add("is-disabled");
      elements.statusLink.setAttribute("aria-disabled", "true");
      elements.statusLink.setAttribute(
        "aria-label",
        UI_TEXT.discordProfileUnavailable,
      );
      elements.statusLink.tabIndex = -1;
      return;
    }

    elements.statusLink.href = `${APP_CONFIG.discordProfileBase}${safeId}`;
    elements.statusLink.classList.remove("is-disabled");
    elements.statusLink.removeAttribute("aria-disabled");
    elements.statusLink.setAttribute(
      "aria-label",
      label ? `Open ${label} on Discord` : UI_TEXT.openDiscordProfile,
    );
    elements.statusLink.tabIndex = 0;
  }

  function setDisconnectedState(message) {
    elements.discordName.textContent = "NEKOLESSI";
    setStatusText(null, message);
    setStatusDot("offline");
    elements.statusAvatar.src = DEFAULT_STATUS_AVATAR;
    setDiscordProfileLink("");

    setActivityArt("", "");
    elements.activityTitle.textContent = UI_TEXT.activityEmptyTitle;
    setActivitySubtitle(UI_TEXT.activityDisconnectedSubtitle);
    stopProgress();
  }

  async function fetchDiscordApplicationIcon(activity) {
    const applicationId = String(activity?.application_id || "").trim();
    if (!applicationId) {
      return "";
    }

    if (discordApplicationIconCache.has(applicationId)) {
      return discordApplicationIconCache.get(applicationId);
    }

    if (!DISCORD_APP_WORKER_URL) {
      throw new Error(
        "Set APP_CONFIG.viewCounterWorkerUrl to derive the Discord app endpoint.",
      );
    }

    const response = await withTimeout(
      fetchImpl(`${DISCORD_APP_WORKER_URL}/${applicationId}`, {
        cache: "force-cache",
      }),
      VIEW_FETCH_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Discord application lookup failed (${response.status})`);
    }

    const payload = await response.json();
    const iconUrl = String(payload?.iconUrl || "").trim();
    discordApplicationIconCache.set(applicationId, iconUrl);
    return iconUrl;
  }

  async function resolveActivityArt(activity) {
    const richAssetUrl = activityImageFromDiscord(activity);
    if (richAssetUrl) {
      return richAssetUrl;
    }

    try {
      return (await fetchDiscordApplicationIcon(activity)) || "";
    } catch {
      return "";
    }
  }

  async function renderPresence(data) {
    const user = data.discord_user || {};
    const displayName =
      user.global_name || user.display_name || user.username || "Discord User";
    const avatarHash = user.avatar;
    const avatarUrl = avatarHash
      ? `https://cdn.discordapp.com/avatars/${user.id}/${avatarHash}.png?size=256`
      : DEFAULT_STATUS_AVATAR;

    const customStatus = Array.isArray(data.activities)
      ? data.activities.find((activity) => activity.type === 4)
      : null;
    const isStreaming =
      Array.isArray(data.activities) &&
      data.activities.some((activity) => activity.type === 1);

    setDiscordProfileLink(user.id || APP_CONFIG.discordUserId, displayName);
    elements.discordName.textContent = displayName.toUpperCase();
    elements.statusAvatar.src = avatarUrl;
    setStatusDot(isStreaming ? "streaming" : data.discord_status || "offline");
    setStatusText(
      customStatus,
      UI_TEXT.discordStatusMap[data.discord_status] ||
        UI_TEXT.discordStatusMap.offline,
    );

    if (data.listening_to_spotify && data.spotify) {
      const spotify = data.spotify;
      const spotifyArtUrl = resolveSpotifyArtUrl(spotify.album_art_url);
      setActivityArt(
        spotifyArtUrl,
        spotify.song || UI_TEXT.spotifyFallbackTitle,
      );
      elements.activityTitle.textContent =
        spotify.song || UI_TEXT.spotifyFallbackTitle;
      setActivitySubtitle(
        `${spotify.artist || "Unknown artist"} - ${spotify.album || "Unknown album"}`,
      );
      startProgress(spotify.timestamps?.start, spotify.timestamps?.end);
      return;
    }

    const richActivity = pickRichActivity(data.activities);
    if (richActivity) {
      const titleText =
        richActivity.name ||
        richActivity.details ||
        richActivity.state ||
        UI_TEXT.activityFallbackTitle;
      const subtitleParts = [richActivity.details, richActivity.state]
        .map((value) => String(value || "").trim())
        .filter(
          (value, index, parts) =>
            value && value !== titleText && parts.indexOf(value) === index,
        );

      setActivityArt(await resolveActivityArt(richActivity), titleText);
      elements.activityTitle.textContent = titleText;
      setActivitySubtitle(subtitleParts.join(" - "));
      startProgress(
        richActivity.timestamps?.start,
        richActivity.timestamps?.end,
      );
      return;
    }

    setActivityArt("", "");
    elements.activityTitle.textContent = UI_TEXT.activityEmptyTitle;
    setActivitySubtitle(UI_TEXT.activityInactiveSubtitle);
    stopProgress();
  }

  async function fetchPresence() {
    if (
      !hasPresenceElements ||
      presenceFetchInFlight ||
      isDocumentHidden(documentRef)
    ) {
      return;
    }

    presenceFetchInFlight = true;

    if (!isUserIdSet()) {
      setDisconnectedState(UI_TEXT.statusUserIdMissing);
      presenceFetchInFlight = false;
      return;
    }

    try {
      const response = await fetchImpl(
        `${APP_CONFIG.lanyardBase}${APP_CONFIG.discordUserId}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(`Lanyard request failed (${response.status})`);
      }

      const payload = await response.json();
      if (!payload.success || !payload.data) {
        throw new Error("Invalid Lanyard payload");
      }

      await renderPresence(payload.data);
    } catch {
      setDisconnectedState(UI_TEXT.statusUnavailable);
    } finally {
      presenceFetchInFlight = false;
    }
  }

  async function start() {
    if (!hasPresenceElements) {
      return;
    }

    await fetchPresence();
    refreshTimer = setIntervalImpl(
      fetchPresence,
      APP_CONFIG.presenceRefreshIntervalMs,
    );
    visibilityHandler = () => {
      if (!isDocumentHidden(documentRef)) {
        void fetchPresence();
      }
    };
    documentRef.addEventListener("visibilitychange", visibilityHandler);
  }

  function destroy() {
    if (refreshTimer) {
      clearIntervalImpl(refreshTimer);
      refreshTimer = null;
    }

    if (visibilityHandler) {
      documentRef.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = null;
    }

    stopProgress();
  }

  return {
    start,
    destroy,
    fetchPresence,
  };
}
