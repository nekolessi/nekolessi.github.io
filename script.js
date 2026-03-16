const DISCORD_USER_ID = "1116207043544612985";
const LANYARD_BASE = "https://api.lanyard.rest/v1/users/";
const HERO_PROFILE_IMAGE_LOCAL = "images/profile.png";
const HERO_PROFILE_IMAGE_URL = ""; // Optional: set a full image URL here if you want to use a link instead.
const HERO_PROFILE_IMAGE = HERO_PROFILE_IMAGE_URL || HERO_PROFILE_IMAGE_LOCAL;
const PROFILE_LOCATION = "USA";
const VIEW_COUNTER_WORKER_URL = "https://nekolessi-view-counter.nekolessi.workers.dev/views"; // Optional: set to your Cloudflare Worker URL, e.g. https://your-worker.workers.dev/views
const REACTIONS_WORKER_URL = deriveReactionsWorkerUrl();
const VIEW_BADGE_URL = "https://visitor-badge.laobi.icu/badge?page_id=nekolessi.nekolessi.github.io&left_text=%20";
const VIEW_BADGE_PROXY_BASE = "https://api.allorigins.win/get?url=";
const VIEW_FETCH_TIMEOUT_MS = 4500;
const DISCORD_PROFILE_BASE = "https://discord.com/users/";
const DEFAULT_STATUS_AVATAR =
  "https://images.unsplash.com/photo-1578632292335-df3abbb0d586?auto=format&fit=crop&w=220&q=80";
const DEFAULT_ACTIVITY_ART =
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=300&q=80";

// Easy config: edit links here (add/remove/reorder as you want).
// Social icons use Simple Icons only.
const PROFILE_LINKS = [
  { label: "Oshi Card", simpleIcon: "premid", iconColor: "43E55E", href: "oshi.to/nekolessi" },
  { label: "Email", simpleIcon: "gmail", iconColor: "EA4335", href: "nekolessi.july916@passinbox.com", type: "email" },
  { label: "Twitch", simpleIcon: "twitch", iconColor: "9146FF", href: "twitch.tv/nekolessi" },
  { label: "Ko-fi", simpleIcon: "kofi", iconColor: "72A5F2", href: "ko-fi.com/nekolessi" },
  { label: "Spotify", simpleIcon: "spotify", iconColor: "1ED760", href: "open.spotify.com/user/md3unqsz1utqazf1rtrvdos09" },
  { label: "Throne", simpleIcon: "ilovepdf", iconColor: "FFDD00", href: "throne.com/nekolessi" },
  { label: "Telegram", simpleIcon: "telegram", iconColor: "26A5E4", href: "t.me/nekolessi" }
];
const PROFILE_REACTIONS = [
  { id: "heart", emoji: "💗", label: "Like catgirls" }
];
const REACTION_LOCAL_KEY = "nekolessi_profile_reaction_choice";

const heroProfileImage = document.getElementById("heroProfileImage");
const profileViews = document.getElementById("profileViews");
const profileLocation = document.getElementById("profileLocation");
const socialLinksRoot = document.getElementById("socialLinks");
const reactionsSection = document.getElementById("reactionsSection");
const profileReactionsRoot = document.getElementById("profileReactions");
const reactionStatus = document.getElementById("reactionStatus");
const statusLink = document.getElementById("discordStatusLink");
const statusAvatar = document.getElementById("statusAvatar");
const discordName = document.getElementById("discordName");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("discordStatusText");

const activityArt = document.getElementById("activityArt");
const activityTitle = document.getElementById("activityTitle");
const activitySubtitle = document.getElementById("activitySubtitle");
const timeline = document.getElementById("activityTimeline");
const currentTime = document.getElementById("currentTime");
const totalTime = document.getElementById("totalTime");
const progressFill = document.getElementById("progressFill");
const hasPresenceElements = Boolean(
  statusLink &&
  statusAvatar &&
  discordName &&
  statusDot &&
  statusText &&
  activityArt &&
  activityTitle &&
  activitySubtitle &&
  timeline &&
  currentTime &&
  totalTime &&
  progressFill
);

let progressState = null;
let progressTimer = null;
let profileViewsFetchInFlight = false;
let reactionsFetchInFlight = false;
let presenceFetchInFlight = false;
let selectedReactionId = readStoredReactionChoice();
let reactionCounts = defaultReactionCounts();

if (heroProfileImage) {
  heroProfileImage.src = HERO_PROFILE_IMAGE;
}

if (profileLocation) {
  profileLocation.textContent = PROFILE_LOCATION;
}

async function updateProfileViews() {
  if (!profileViews) {
    return;
  }
  if (profileViewsFetchInFlight) {
    return;
  }

  profileViewsFetchInFlight = true;
  const currentLabel = profileViews.textContent.trim();
  if (!/^\d+$/.test(currentLabel)) {
    profileViews.textContent = "...";
  }

  try {
    const count = await fetchViewCount();
    if (count) {
      profileViews.textContent = count;
    }
  } catch {
    // Keep existing label if counter fetch fails.
  } finally {
    profileViewsFetchInFlight = false;
  }
}

function withTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function parseViewCountFromSvg(svgText) {
  if (typeof svgText !== "string" || !svgText.length) {
    return "";
  }

  const ariaMatch = svgText.match(/aria-label="[^"]*?(\d[\d,]*)"/i);
  if (ariaMatch?.[1]) {
    return ariaMatch[1].replace(/\D/g, "");
  }

  const textMatches = [...svgText.matchAll(/>(\d[\d,]*)<\/text>/g)];
  if (textMatches.length) {
    return textMatches[textMatches.length - 1][1].replace(/\D/g, "");
  }

  return "";
}

async function fetchViewCount() {
  if (VIEW_COUNTER_WORKER_URL.trim()) {
    return fetchViewCountFromWorker();
  }

  return fetchViewCountFromBadgeProxy();
}

async function fetchViewCountFromWorker() {
  const response = await withTimeout(
    fetch(VIEW_COUNTER_WORKER_URL, {
      cache: "no-store"
    }),
    VIEW_FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Worker counter request failed (${response.status})`);
  }

  const payload = await response.json();
  const count = String(payload?.count ?? "").replace(/\D/g, "");
  if (!count) {
    throw new Error("Worker counter payload missing count");
  }

  return count;
}

async function fetchViewCountFromBadgeProxy() {
  const url = `${VIEW_BADGE_PROXY_BASE}${encodeURIComponent(VIEW_BADGE_URL)}`;
  const response = await withTimeout(
    fetch(url, {
      cache: "no-store"
    }),
    VIEW_FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Counter request failed (${response.status})`);
  }

  const bodyTextRaw = await response.text();
  let bodyText = bodyTextRaw;

  // allorigins /get returns JSON with the upstream body in `contents`.
  try {
    const payload = JSON.parse(bodyTextRaw);
    if (typeof payload?.contents === "string" && payload.contents.length) {
      bodyText = payload.contents;
    }
  } catch {
    // If it's not JSON, continue with raw body as-is.
  }

  const base64Prefix = "data:image/svg+xml;base64,";
  if (bodyText.startsWith(base64Prefix)) {
    bodyText = atob(bodyText.slice(base64Prefix.length));
  }

  const count = parseViewCountFromSvg(bodyText);
  if (!count) {
    throw new Error("Could not parse counter value");
  }

  return count;
}

function deriveReactionsWorkerUrl() {
  const base = (VIEW_COUNTER_WORKER_URL || "").trim();
  if (!base) {
    return "";
  }

  if (/\/views\/?$/i.test(base)) {
    return base.replace(/\/views\/?$/i, "/reactions");
  }

  return `${base.replace(/\/$/, "")}/reactions`;
}

function defaultReactionCounts() {
  return PROFILE_REACTIONS.reduce((acc, reaction) => {
    acc[reaction.id] = 0;
    return acc;
  }, {});
}

function normalizeReactionCounts(rawCounts) {
  const baseCounts = defaultReactionCounts();
  if (!rawCounts || typeof rawCounts !== "object") {
    return baseCounts;
  }

  PROFILE_REACTIONS.forEach((reaction) => {
    const raw = rawCounts[reaction.id];
    const numeric = Number.parseInt(raw, 10);
    if (Number.isFinite(numeric) && numeric >= 0) {
      baseCounts[reaction.id] = numeric;
    }
  });

  return baseCounts;
}

function readStoredReactionChoice() {
  try {
    const value = localStorage.getItem(REACTION_LOCAL_KEY) || "";
    return PROFILE_REACTIONS.some((reaction) => reaction.id === value) ? value : "";
  } catch {
    return "";
  }
}

function storeReactionChoice(reactionId) {
  try {
    localStorage.setItem(REACTION_LOCAL_KEY, reactionId);
  } catch {
    // Ignore storage failures.
  }
}

function normalizeHref(link) {
  const rawHref = (link.href || "").trim();
  if (!rawHref) {
    return "";
  }

  if (link.type === "email") {
    return rawHref.startsWith("mailto:") ? rawHref : `mailto:${rawHref}`;
  }

  if (rawHref.startsWith("http://") || rawHref.startsWith("https://") || rawHref.startsWith("mailto:")) {
    return rawHref;
  }

  return `https://${rawHref}`;
}

function simpleIconUrl(name, color) {
  const iconName = String(name || "").trim().toLowerCase();
  if (!iconName) {
    return "";
  }

  const iconColor = String(color || "f5f1fb").replace(/[^a-fA-F0-9]/g, "");
  return `https://cdn.simpleicons.org/${encodeURIComponent(iconName)}/${iconColor || "f5f1fb"}`;
}

function renderSocialLinks() {
  if (!socialLinksRoot) {
    return;
  }

  socialLinksRoot.innerHTML = "";

  PROFILE_LINKS.forEach((link) => {
    const finalHref = normalizeHref(link);
    if (!finalHref) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = finalHref;
    anchor.title = link.label;
    anchor.setAttribute("aria-label", link.label);

    if (!finalHref.startsWith("mailto:")) {
      anchor.target = "_blank";
      anchor.rel = "noreferrer noopener";
    }

    if (link.simpleIcon) {
      const image = document.createElement("img");
      image.className = "social-icon-image";
      image.src = simpleIconUrl(link.simpleIcon, link.iconColor);
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.loading = "lazy";
      image.decoding = "async";
      anchor.appendChild(image);
    } else {
      return;
    }

    socialLinksRoot.appendChild(anchor);
  });
}

function setReactionStatus(message) {
  if (!reactionStatus) {
    return;
  }

  reactionStatus.textContent = message || "";
}

function renderReactionButtons(counts = reactionCounts) {
  if (!profileReactionsRoot) {
    return;
  }

  reactionCounts = normalizeReactionCounts(counts);
  profileReactionsRoot.innerHTML = "";

  PROFILE_REACTIONS.forEach((reaction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reaction-btn";
    if (selectedReactionId === reaction.id) {
      button.classList.add("active");
    }
    button.setAttribute("aria-pressed", selectedReactionId === reaction.id ? "true" : "false");

    button.setAttribute("aria-label", `${reaction.label} reaction`);
    button.disabled = reactionsFetchInFlight;

    const emoji = document.createElement("span");
    emoji.className = "reaction-emoji";
    emoji.textContent = reaction.emoji;

    const count = document.createElement("span");
    count.className = "reaction-count";
    count.textContent = String(reactionCounts[reaction.id] ?? 0);

    button.appendChild(emoji);
    button.appendChild(count);
    button.addEventListener("click", () => submitReaction(reaction.id));
    profileReactionsRoot.appendChild(button);
  });
}

async function fetchReactionCounts() {
  const response = await withTimeout(
    fetch(REACTIONS_WORKER_URL, {
      cache: "no-store"
    }),
    VIEW_FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Reaction request failed (${response.status})`);
  }

  const payload = await response.json();
  return normalizeReactionCounts(payload?.counts);
}

async function submitReaction(reactionId) {
  if (!REACTIONS_WORKER_URL || reactionsFetchInFlight || !profileReactionsRoot) {
    return;
  }

  reactionsFetchInFlight = true;
  renderReactionButtons();
  setReactionStatus("");

  try {
    const response = await withTimeout(
      fetch(REACTIONS_WORKER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reaction: reactionId })
      }),
      VIEW_FETCH_TIMEOUT_MS
    );

    if (!response.ok) {
      throw new Error(`Reaction update failed (${response.status})`);
    }

    const payload = await response.json();
    const counts = normalizeReactionCounts(payload?.counts);
    selectedReactionId = reactionId;
    storeReactionChoice(reactionId);
    renderReactionButtons(counts);
    setReactionStatus("meow~");
  } catch {
    setReactionStatus("Could not save reaction right now.");
    try {
      const counts = await fetchReactionCounts();
      renderReactionButtons(counts);
    } catch {
      renderReactionButtons();
    }
  } finally {
    reactionsFetchInFlight = false;
    renderReactionButtons();
  }
}

async function initProfileReactions() {
  if (!reactionsSection || !profileReactionsRoot) {
    return;
  }

  if (!REACTIONS_WORKER_URL) {
    reactionsSection.style.display = "none";
    return;
  }

  renderReactionButtons();
  setReactionStatus("");

  try {
    const counts = await fetchReactionCounts();
    renderReactionButtons(counts);
  } catch {
    setReactionStatus("Reactions offline right now.");
  }
}

if (statusAvatar) {
  statusAvatar.onerror = () => {
    if (statusAvatar.src !== DEFAULT_STATUS_AVATAR) {
      statusAvatar.src = DEFAULT_STATUS_AVATAR;
    }
  };
}

if (activityArt) {
  activityArt.onerror = () => {
    if (activityArt.src !== DEFAULT_ACTIVITY_ART) {
      activityArt.src = DEFAULT_ACTIVITY_ART;
    }
  };
}

if (heroProfileImage) {
  heroProfileImage.onerror = () => {
    if (heroProfileImage.src !== HERO_PROFILE_IMAGE_LOCAL) {
      heroProfileImage.src = HERO_PROFILE_IMAGE_LOCAL;
      return;
    }
    heroProfileImage.style.opacity = "0.45";
  };
}

function isUserIdSet() {
  return /^\d{17,20}$/.test(DISCORD_USER_ID);
}

function resolveSpotifyArtUrl(input) {
  if (!input || typeof input !== "string") {
    return "";
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }

  return `https://i.scdn.co/image/${input}`;
}

function formatMs(ms) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const min = Math.floor(totalSeconds / 60);
  const sec = String(totalSeconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function setStatusDot(status) {
  if (!statusDot) {
    return;
  }
  statusDot.classList.remove("online", "idle", "dnd", "offline", "streaming");
  statusDot.classList.add(status || "offline");
}

function customEmojiUrl(emoji) {
  if (!emoji || typeof emoji !== "object" || !emoji.id) {
    return "";
  }

  const extension = emoji.animated ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${extension}?size=64&quality=lossless`;
}

function setStatusText(customStatus, fallbackText) {
  if (!statusText) {
    return;
  }

  const fallback = fallbackText || "Offline";
  statusText.textContent = "";

  const statusState = (customStatus?.state || "").trim();
  const emoji = customStatus?.emoji;
  const emojiUrl = customEmojiUrl(emoji);

  if (!statusState && !emoji && !emojiUrl) {
    statusText.textContent = fallback;
    return;
  }

  const wrapper = document.createElement("span");
  wrapper.className = "status-text-content";

  if (emojiUrl) {
    const img = document.createElement("img");
    img.className = "status-emoji";
    img.src = emojiUrl;
    img.alt = emoji?.name || "status emoji";
    wrapper.appendChild(img);
  } else if (emoji?.name) {
    const emojiSpan = document.createElement("span");
    emojiSpan.className = "status-emoji status-emoji-unicode";
    emojiSpan.textContent = emoji.name;
    wrapper.appendChild(emojiSpan);
  }

  if (statusState) {
    const textNode = document.createElement("span");
    textNode.textContent = statusState;
    wrapper.appendChild(textNode);
  }

  statusText.appendChild(wrapper);
}

function startProgress(startMs, endMs) {
  stopProgress();

  if (!startMs || !endMs || endMs <= startMs) {
    timeline.classList.add("hidden");
    return;
  }

  progressState = { startMs, endMs };
  timeline.classList.remove("hidden");

  const tick = () => {
    if (!progressState) {
      return;
    }

    const now = Date.now();
    const duration = progressState.endMs - progressState.startMs;
    const elapsed = Math.min(Math.max(now - progressState.startMs, 0), duration);
    const percent = Math.min((elapsed / duration) * 100, 100);

    currentTime.textContent = formatMs(elapsed);
    totalTime.textContent = formatMs(duration);
    progressFill.style.width = `${percent}%`;
  };

  tick();
  progressTimer = setInterval(tick, 1000);
}

function stopProgress() {
  progressState = null;
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  timeline.classList.add("hidden");
  progressFill.style.width = "0%";
  currentTime.textContent = "0:00";
  totalTime.textContent = "0:00";
}

function setDisconnectedState(message) {
  discordName.textContent = "NEKOLESSI";
  setStatusText(null, message);
  setStatusDot("offline");
  statusAvatar.src = DEFAULT_STATUS_AVATAR;
  setDiscordProfileLink("");

  activityArt.src = DEFAULT_ACTIVITY_ART;
  activityTitle.textContent = "Nothing active right now";
  activitySubtitle.textContent = "Once linked, this updates from your Discord activity.";
  stopProgress();
}

function setDiscordProfileLink(userId, label = "") {
  if (!statusLink) {
    return;
  }

  const safeId = String(userId || "").trim();
  if (!safeId) {
    statusLink.removeAttribute("href");
    statusLink.classList.add("is-disabled");
    statusLink.setAttribute("aria-disabled", "true");
    statusLink.setAttribute("aria-label", "Discord profile unavailable");
    statusLink.tabIndex = -1;
    return;
  }

  statusLink.href = `${DISCORD_PROFILE_BASE}${safeId}`;
  statusLink.classList.remove("is-disabled");
  statusLink.removeAttribute("aria-disabled");
  statusLink.setAttribute("aria-label", label ? `Open ${label} on Discord` : "Open Discord profile");
  statusLink.tabIndex = 0;
}

function activityImageFromDiscord(activity) {
  if (!activity || !activity.assets) {
    return "";
  }

  const { large_image: largeImage } = activity.assets;

  if (!largeImage) {
    return "";
  }

  if (largeImage.startsWith("mp:")) {
    return `https://media.discordapp.net/${largeImage.slice(3)}`;
  }

  if (!activity.application_id) {
    return "";
  }

  return `https://cdn.discordapp.com/app-assets/${activity.application_id}/${largeImage}.png`;
}

function pickRichActivity(activities) {
  if (!Array.isArray(activities)) {
    return null;
  }

  return activities.find((item) => item.type !== 4 && item.name) || null;
}

function renderPresence(data) {
  const user = data.discord_user || {};
  const displayName = user.global_name || user.display_name || user.username || "Discord User";
  const avatarHash = user.avatar;
  const avatarUrl = avatarHash
    ? `https://cdn.discordapp.com/avatars/${user.id}/${avatarHash}.png?size=256`
    : DEFAULT_STATUS_AVATAR;

  const customStatus = Array.isArray(data.activities)
    ? data.activities.find((item) => item.type === 4)
    : null;

  const statusMap = {
    online: "Online",
    idle: "Idle",
    dnd: "Do not disturb",
    offline: "Offline"
  };
  const isStreaming = Array.isArray(data.activities) && data.activities.some((item) => item.type === 1);

  setDiscordProfileLink(user.id || DISCORD_USER_ID, displayName);
  discordName.textContent = displayName.toUpperCase();
  statusAvatar.src = avatarUrl;
  setStatusDot(isStreaming ? "streaming" : data.discord_status || "offline");
  setStatusText(customStatus, statusMap[data.discord_status] || "Offline");

  if (data.listening_to_spotify && data.spotify) {
    const spotify = data.spotify;
    const albumArtId = spotify.album_art_url;
    const spotifyArtUrl = resolveSpotifyArtUrl(albumArtId);

    activityArt.src = spotifyArtUrl || DEFAULT_ACTIVITY_ART;
    activityTitle.textContent = spotify.song || "Listening on Spotify";
    activitySubtitle.textContent = `${spotify.artist || "Unknown artist"} - ${spotify.album || "Unknown album"}`;
    startProgress(spotify.timestamps?.start, spotify.timestamps?.end);
    return;
  }

  const richActivity = pickRichActivity(data.activities);
  if (richActivity) {
    const detailText = richActivity.details || richActivity.state || "Active on Discord";
    const subText = richActivity.name || "Activity";
    const richImage = activityImageFromDiscord(richActivity);

    activityArt.src = richImage || DEFAULT_ACTIVITY_ART;
    activityTitle.textContent = detailText;
    activitySubtitle.textContent = subText;
    startProgress(richActivity.timestamps?.start, richActivity.timestamps?.end);
    return;
  }

  activityArt.src = DEFAULT_ACTIVITY_ART;
  activityTitle.textContent = "Nothing active right now";
  activitySubtitle.textContent = "Open a game or Spotify and this card will update.";
  stopProgress();
}

async function fetchPresence() {
  if (!hasPresenceElements) {
    return;
  }

  if (presenceFetchInFlight) {
    return;
  }

  if (typeof document !== "undefined" && document.hidden) {
    return;
  }

  presenceFetchInFlight = true;

  if (!isUserIdSet()) {
    setDisconnectedState("Set your Discord user ID in script.js to load live presence.");
    presenceFetchInFlight = false;
    return;
  }

  try {
    const response = await fetch(`${LANYARD_BASE}${DISCORD_USER_ID}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Lanyard request failed (${response.status})`);
    }

    const payload = await response.json();
    if (!payload.success || !payload.data) {
      throw new Error("Invalid Lanyard payload");
    }

    renderPresence(payload.data);
  } catch {
    setDisconnectedState("Could not reach Discord presence feed right now.");
  } finally {
    presenceFetchInFlight = false;
  }
}

renderSocialLinks();
initProfileReactions();
updateProfileViews();
fetchPresence();
setInterval(fetchPresence, 20000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    fetchPresence();
  }
});
