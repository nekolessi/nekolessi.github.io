export function withTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timeoutId),
  );
}

export function normalizeHref(link) {
  const rawHref = String(link?.href || "").trim();
  if (!rawHref) {
    return "";
  }

  if (link.type === "email") {
    return rawHref.startsWith("mailto:") ? rawHref : `mailto:${rawHref}`;
  }

  if (
    rawHref.startsWith("http://") ||
    rawHref.startsWith("https://") ||
    rawHref.startsWith("mailto:")
  ) {
    return rawHref;
  }

  return `https://${rawHref}`;
}

export function simpleIconUrl(name, color) {
  const iconName = String(name || "")
    .trim()
    .toLowerCase();
  if (!iconName) {
    return "";
  }

  const iconColor = String(color || "f5f1fb").replace(/[^a-fA-F0-9]/g, "");
  return `https://cdn.simpleicons.org/${encodeURIComponent(iconName)}/${iconColor || "f5f1fb"}`;
}

export function resolveSpotifyArtUrl(input) {
  if (!input || typeof input !== "string") {
    return "";
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }

  return `https://i.scdn.co/image/${input}`;
}

export function formatMs(ms) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`;
  }

  return `${Math.floor(totalSeconds / 60)}:${seconds}`;
}

export function customEmojiUrl(emoji) {
  if (!emoji || typeof emoji !== "object" || !emoji.id) {
    return "";
  }

  const extension = emoji.animated ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${extension}?size=64&quality=lossless`;
}
