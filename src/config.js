/**
 * @typedef {"email"} ProfileLinkType
 */

/**
 * @typedef {Object} ProfileLink
 * @property {string} label
 * @property {string} simpleIcon
 * @property {string} iconColor
 * @property {string} href
 * @property {ProfileLinkType} [type]
 */

/**
 * @typedef {Object} ProfileConfig
 * @property {string} location
 * @property {string[]} bioBlocks
 * @property {ProfileLink[]} links
 */

/**
 * @typedef {Object} ProfileReaction
 * @property {string} id
 * @property {string} emoji
 * @property {string} label
 */

export const APP_CONFIG = {
  discordUserId: "1116207043544612985",
  lanyardBase: "https://api.lanyard.rest/v1/users/",
  heroProfileImageLocal: "images/profile.png",
  heroProfileImageUrl: "",
  viewCounterWorkerUrl:
    "https://nekolessi-view-counter.nekolessi.workers.dev/views",
  viewFetchTimeoutMs: 4500,
  presenceRefreshIntervalMs: 20_000,
  discordProfileBase: "https://discord.com/users/",
  defaultActivityArt: "images/activity-fallback.svg",
};

export const UI_TEXT = {
  statusEyebrow: "DISCORD STATUS",
  activityEyebrow: "NOW PLAYING / LISTENING",
  reactionsTitle: "click if you like catgirls",
  profileViewsLoading: "Profile views loading",
  reactionSaved: "meow mrrp mew~",
  reactionsOffline: "Reactions offline right now.",
  reactionSaveFailed: "Could not save reaction right now.",
  statusUserIdMissing:
    "Set your Discord user ID in src/config.js to load live presence.",
  statusUnavailable: "Could not reach Discord presence feed right now.",
  discordProfileUnavailable: "Discord profile unavailable",
  openDiscordProfile: "Open Discord profile",
  activityEmptyTitle: "Nothing active",
  activityDisconnectedSubtitle:
    "Once linked, this updates from your Discord activity.",
  activityInactiveSubtitle: "Open a game or Spotify and this card will update.",
  activityFallbackTitle: "Active on Discord",
  spotifyFallbackTitle: "Listening on Spotify",
  discordStatusMap: {
    online: "Online",
    idle: "Idle",
    dnd: "Do not disturb",
    offline: "Offline",
  },
};

/** @type {ProfileConfig} */
export const PROFILE = {
  location: "USA",
  bioBlocks: [
    "OH HAII~ I'M JUST A HOPELESS GIRLFAILURE...",
    "I SPEND MY FREE TIME WATCHING VTUBERS, DOODLING WHEN MY BRAIN COOPERATES, AND ZONING OUT LIKE I FORGOT HOW TO EXIST...",
    "I'M SHY, DUMB, A LITTLE NEEDY, AND A TINY BIT BRATTY~ SO PLS BE NICE TO ME OR I'LL POUT AND MAYBE CRY A LITTLE...",
  ],
  links: [
    {
      label: "Oshi Card",
      simpleIcon: "premid",
      iconColor: "CC5CC1",
      href: "oshi.to/nekolessi",
    },
    {
      label: "Email",
      simpleIcon: "gmail",
      iconColor: "EA4335",
      href: "nekolessi.july916@passinbox.com",
      type: "email",
    },
    {
      label: "Twitch",
      simpleIcon: "twitch",
      iconColor: "9146FF",
      href: "twitch.tv/nekolessi",
    },
    {
      label: "Spotify",
      simpleIcon: "spotify",
      iconColor: "1ED760",
      href: "open.spotify.com/user/md3unqsz1utqazf1rtrvdos09",
    },
    {
      label: "Telegram",
      simpleIcon: "telegram",
      iconColor: "26A5E4",
      href: "t.me/nekolessi",
    },
    {
      label: "Ko-fi",
      simpleIcon: "kofi",
      iconColor: "72A5F2",
      href: "ko-fi.com/nekolessi",
    },
    {
      label: "Throne",
      simpleIcon: "ilovepdf",
      iconColor: "FFDD00",
      href: "throne.com/nekolessi",
    },
  ],
};

/** @type {ProfileReaction[]} */
export const PROFILE_REACTIONS = [
  { id: "heart", emoji: "\u{1F497}", label: "Like catgirls" },
];

export const REACTION_LOCAL_KEY = "nekolessi_profile_reaction_choice";
export const REACTION_EMOJI_BY_ID = {
  heart: "\u{1F497}",
};

export const HERO_PROFILE_IMAGE =
  APP_CONFIG.heroProfileImageUrl || APP_CONFIG.heroProfileImageLocal;
export const VIEW_COUNTER_WORKER_URL = APP_CONFIG.viewCounterWorkerUrl;
export const VIEW_FETCH_TIMEOUT_MS = APP_CONFIG.viewFetchTimeoutMs;
export const DEFAULT_STATUS_AVATAR = APP_CONFIG.heroProfileImageLocal;
export const DEFAULT_ACTIVITY_ART = APP_CONFIG.defaultActivityArt;

export function deriveReactionsWorkerUrl(base = VIEW_COUNTER_WORKER_URL) {
  const trimmedBase = (base || "").trim();
  if (!trimmedBase) {
    return "";
  }

  if (/\/views\/?$/i.test(trimmedBase)) {
    return trimmedBase.replace(/\/views\/?$/i, "/reactions");
  }

  return `${trimmedBase.replace(/\/$/, "")}/reactions`;
}

export function deriveDiscordAppWorkerUrl(base = VIEW_COUNTER_WORKER_URL) {
  const trimmedBase = (base || "").trim();
  if (!trimmedBase) {
    return "";
  }

  if (/\/views\/?$/i.test(trimmedBase)) {
    return trimmedBase.replace(/\/views\/?$/i, "/discord-app");
  }

  return `${trimmedBase.replace(/\/$/, "")}/discord-app`;
}

export const REACTIONS_WORKER_URL = deriveReactionsWorkerUrl();
export const DISCORD_APP_WORKER_URL = deriveDiscordAppWorkerUrl();

export function defaultReactionCounts() {
  return PROFILE_REACTIONS.reduce((accumulator, reaction) => {
    accumulator[reaction.id] = 0;
    return accumulator;
  }, {});
}

export function normalizeReactionCounts(rawCounts) {
  const baseCounts = defaultReactionCounts();
  if (!rawCounts || typeof rawCounts !== "object") {
    return baseCounts;
  }

  PROFILE_REACTIONS.forEach((reaction) => {
    const rawValue = rawCounts[reaction.id];
    const numericValue = Number.parseInt(rawValue, 10);
    if (Number.isFinite(numericValue) && numericValue >= 0) {
      baseCounts[reaction.id] = numericValue;
    }
  });

  return baseCounts;
}
