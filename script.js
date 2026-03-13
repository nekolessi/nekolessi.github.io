const DISCORD_USER_ID = "1116207043544612985";
const LANYARD_BASE = "https://api.lanyard.rest/v1/users/";
const DEFAULT_STATUS_AVATAR =
  "https://images.unsplash.com/photo-1578632292335-df3abbb0d586?auto=format&fit=crop&w=220&q=80";
const DEFAULT_ACTIVITY_ART =
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=300&q=80";

// Easy config: edit links here (add/remove/reorder as you want).
const PROFILE_LINKS = [
  { label: "Email", icon: "fa-solid fa-envelope", href: "nekolessi.july916@passinbox.com", type: "email" },
  { label: "Carrd", icon: "fa-solid fa-id-card", href: "nekolessi.uwu.ai" },
  { label: "Twitch", icon: "fa-brands fa-twitch", href: "twitch.tv/nekolessi" },
  { label: "Steam", icon: "fa-brands fa-steam", href: "steamcommunity.com/id/nekolessi/" },
  { label: "Spotify", icon: "fa-brands fa-spotify", href: "open.spotify.com/user/md3unqsz1utqazf1rtrvdos09" },
  { label: "Oshi Card", icon: "fa-solid fa-link", href: "https://oshi.to/nekolessi" },
  { label: "Throne", icon: "fa-solid fa-crown", href: "https://throne.com/nekolessi" },
  { label: "Telegram", icon: "fa-brands fa-telegram", href: "t.me/nekolessi" }
];

const socialLinksRoot = document.getElementById("socialLinks");
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

let progressState = null;
let progressTimer = null;

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

    const icon = document.createElement("i");
    icon.className = link.icon;
    anchor.appendChild(icon);
    socialLinksRoot.appendChild(anchor);
  });
}

statusAvatar.onerror = () => {
  if (statusAvatar.src !== DEFAULT_STATUS_AVATAR) {
    statusAvatar.src = DEFAULT_STATUS_AVATAR;
  }
};

activityArt.onerror = () => {
  if (activityArt.src !== DEFAULT_ACTIVITY_ART) {
    activityArt.src = DEFAULT_ACTIVITY_ART;
  }
};

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
  statusDot.classList.remove("online", "idle", "dnd", "offline");
  statusDot.classList.add(status || "offline");
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
  statusText.textContent = message;
  setStatusDot("offline");
  statusAvatar.src = DEFAULT_STATUS_AVATAR;

  activityArt.src = DEFAULT_ACTIVITY_ART;
  activityTitle.textContent = "Nothing active right now";
  activitySubtitle.textContent = "Once linked, this updates from your Discord activity.";
  stopProgress();
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
    ? data.activities.find((item) => item.type === 4 && item.state)
    : null;

  const statusMap = {
    online: "Online",
    idle: "Idle",
    dnd: "Do not disturb",
    offline: "Offline"
  };

  statusLink.href = `https://discord.com/users/${user.id || DISCORD_USER_ID}`;
  discordName.textContent = displayName.toUpperCase();
  statusAvatar.src = avatarUrl;
  setStatusDot(data.discord_status || "offline");
  statusText.textContent = customStatus?.state || statusMap[data.discord_status] || "Offline";

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
  if (!isUserIdSet()) {
    setDisconnectedState("Set your Discord user ID in script.js to load live presence.");
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
  }
}

renderSocialLinks();
fetchPresence();
setInterval(fetchPresence, 20000);
