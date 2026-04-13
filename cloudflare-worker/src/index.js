const COUNTER_OBJECT_NAME = "profile-counter";
const COUNTER_KEY = "profile_views_total";
const COUNTER_INIT = 0;
const REACTIONS_KEY = "profile_reactions_counts";
const VIEW_RATE_LIMIT_PREFIX = "view_rate_limit:";
const REACTION_RATE_LIMIT_PREFIX = "reaction_rate_limit:";
const REACTION_IDS = ["heart"];
const DEFAULT_ALLOWED_ORIGINS = ["https://nekolessi.github.io"];
const DEFAULT_VIEW_MIN_INTERVAL_MS = 120_000;
const DEFAULT_REACTION_MIN_INTERVAL_MS = 10_000;
const DISCORD_APP_ROUTE_PREFIX = "/discord-app/";
const ADMIN_VIEWS_PATH = "/admin/views";
const DISCORD_RPC_BASE = "https://discord.com/api/v10/oauth2/applications/";
const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  });
}

function mergeCorsHeaders(response, request, env) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("Origin");

  if (origin && isAllowedOrigin(origin, env)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  Object.entries(CORS_HEADERS).forEach(([key, value]) =>
    headers.set(key, value),
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function defaultReactions() {
  return REACTION_IDS.reduce((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {});
}

function normalizeReactions(raw) {
  const base = defaultReactions();
  if (!raw || typeof raw !== "object") {
    return base;
  }

  REACTION_IDS.forEach((id) => {
    const numeric = Number.parseInt(raw[id], 10);
    if (Number.isFinite(numeric) && numeric >= 0) {
      base[id] = numeric;
    }
  });

  return base;
}

function readStoredReactions(raw) {
  if (typeof raw === "string") {
    try {
      return normalizeReactions(JSON.parse(raw));
    } catch {
      return defaultReactions();
    }
  }

  return normalizeReactions(raw);
}

function normalizeOriginValue(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function parseAllowedOrigins(env) {
  const raw = String(env?.ALLOWED_ORIGINS || env?.ALLOWED_ORIGIN || "")
    .split(",")
    .map((origin) => normalizeOriginValue(origin))
    .filter(Boolean);

  return raw.length ? raw : DEFAULT_ALLOWED_ORIGINS;
}

function isAllowedOrigin(origin, env) {
  const normalizedOrigin = normalizeOriginValue(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return parseAllowedOrigins(env).includes(normalizedOrigin);
}

function isDiscordAppPath(pathname) {
  return pathname.startsWith(DISCORD_APP_ROUTE_PREFIX);
}

function requiresAllowedOrigin(pathname, method) {
  return (
    pathname === "/views" ||
    (pathname === "/reactions" && method === "POST") ||
    (isDiscordAppPath(pathname) && method === "GET")
  );
}

function isKnownPath(pathname) {
  return (
    pathname === "/views" ||
    pathname === "/reactions" ||
    pathname === ADMIN_VIEWS_PATH ||
    isDiscordAppPath(pathname)
  );
}

function getAdminToken(env) {
  return String(env?.ADMIN_API_TOKEN || "").trim();
}

function isAuthorizedAdminRequest(request, env) {
  const expectedToken = getAdminToken(env);
  if (!expectedToken) {
    return false;
  }

  const authorization = String(request.headers.get("Authorization") || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return false;
  }

  return match[1].trim() === expectedToken;
}

function parseDiscordApplicationId(pathname) {
  if (!isDiscordAppPath(pathname)) {
    return "";
  }

  const applicationId = pathname.slice(DISCORD_APP_ROUTE_PREFIX.length).trim();
  return /^\d{17,20}$/.test(applicationId) ? applicationId : "";
}

async function fetchDiscordApplication(applicationId) {
  const response = await fetch(`${DISCORD_RPC_BASE}${applicationId}/rpc`, {
    headers: {
      Accept: "application/json",
    },
    cf: {
      cacheTtl: 86_400,
      cacheEverything: true,
    },
  });

  if (response.status === 404) {
    return jsonResponse({ error: "Discord application not found" }, 404);
  }

  if (!response.ok) {
    return jsonResponse(
      { error: `Discord application lookup failed (${response.status})` },
      502,
    );
  }

  const payload = await response.json();
  const iconHash = String(payload?.icon || "").trim();

  return jsonResponse(
    {
      id: applicationId,
      name: String(payload?.name || "").trim(),
      iconUrl: iconHash
        ? `https://cdn.discordapp.com/app-icons/${applicationId}/${iconHash}.png?size=256`
        : "",
    },
    200,
    {
      "Cache-Control": "public, max-age=86400",
    },
  );
}

function getClientIp(request) {
  const headerValue =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "";
  const ip = headerValue.split(",")[0].trim();
  if (ip) {
    return ip;
  }

  const userAgent = String(request.headers.get("User-Agent") || "").trim();
  if (userAgent) {
    return `ua:${encodeURIComponent(userAgent)}`;
  }

  return "";
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getReactionMinIntervalMs(env) {
  return parsePositiveInteger(
    env?.REACTION_MIN_INTERVAL_MS,
    DEFAULT_REACTION_MIN_INTERVAL_MS,
  );
}

function getViewMinIntervalMs(env) {
  return parsePositiveInteger(
    env?.VIEW_MIN_INTERVAL_MS,
    DEFAULT_VIEW_MIN_INTERVAL_MS,
  );
}

function createCounterStub(env) {
  if (!env?.PROFILE_COUNTER) {
    return null;
  }

  const id = env.PROFILE_COUNTER.idFromName(COUNTER_OBJECT_NAME);
  return env.PROFILE_COUNTER.get(id);
}

function createDurableObjectRequest(request, pathname, env, bodyText) {
  const headers = new Headers();
  const contentType = request.headers.get("Content-Type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const clientIp = getClientIp(request);
  if (clientIp) {
    headers.set("X-Client-IP", clientIp);
  }

  headers.set("X-Reaction-Min-Interval-Ms", `${getReactionMinIntervalMs(env)}`);
  headers.set("X-View-Min-Interval-Ms", `${getViewMinIntervalMs(env)}`);

  return new Request(`https://profile-counter${pathname}`, {
    method: request.method,
    headers,
    body: bodyText,
  });
}

export class ProfileCounterDurableObject {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/views") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const currentRaw = await this.state.storage.get(COUNTER_KEY);
      const current =
        Number.parseInt(currentRaw ?? `${COUNTER_INIT}`, 10) || COUNTER_INIT;
      const clientIp = request.headers.get("X-Client-IP") || "";
      const minIntervalMs = parsePositiveInteger(
        request.headers.get("X-View-Min-Interval-Ms"),
        DEFAULT_VIEW_MIN_INTERVAL_MS,
      );
      const rateKey = clientIp ? `${VIEW_RATE_LIMIT_PREFIX}${clientIp}` : "";
      const now = Date.now();

      if (rateKey) {
        const lastViewAt = parsePositiveInteger(
          await this.state.storage.get(rateKey),
          0,
        );

        if (lastViewAt && now - lastViewAt < minIntervalMs) {
          return jsonResponse({
            count: current,
            cooldownActive: true,
            retryAfterMs: minIntervalMs - (now - lastViewAt),
          });
        }
      }

      const next = current + 1;

      await this.state.storage.put(COUNTER_KEY, `${next}`);
      if (rateKey) {
        await this.state.storage.put(rateKey, `${now}`);
      }
      return jsonResponse({ count: next });
    }

    if (url.pathname === ADMIN_VIEWS_PATH) {
      if (request.method === "GET") {
        const currentRaw = await this.state.storage.get(COUNTER_KEY);
        const current =
          Number.parseInt(currentRaw ?? `${COUNTER_INIT}`, 10) || COUNTER_INIT;
        return jsonResponse({ count: current });
      }

      if (request.method === "POST") {
        let payload;
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON payload" }, 400);
        }

        const next = Number.parseInt(payload?.count, 10);
        if (!Number.isFinite(next) || next < 0) {
          return jsonResponse({ error: "Invalid count" }, 400);
        }

        await this.state.storage.put(COUNTER_KEY, `${next}`);
        return jsonResponse({ count: next });
      }

      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/reactions") {
      if (request.method === "GET") {
        const raw = await this.state.storage.get(REACTIONS_KEY);
        return jsonResponse({ counts: readStoredReactions(raw) });
      }

      if (request.method === "POST") {
        let payload;
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON payload" }, 400);
        }

        const reaction = String(payload?.reaction || "").trim();
        if (!REACTION_IDS.includes(reaction)) {
          return jsonResponse({ error: "Invalid reaction type" }, 400);
        }

        const clientIp = request.headers.get("X-Client-IP") || "unknown";
        const minIntervalMs = parsePositiveInteger(
          request.headers.get("X-Reaction-Min-Interval-Ms"),
          DEFAULT_REACTION_MIN_INTERVAL_MS,
        );
        const rateKey = `${REACTION_RATE_LIMIT_PREFIX}${clientIp}`;
        const now = Date.now();
        const lastReactionAt = parsePositiveInteger(
          await this.state.storage.get(rateKey),
          0,
        );

        if (lastReactionAt && now - lastReactionAt < minIntervalMs) {
          return jsonResponse(
            {
              error: "Too many reactions. Try again shortly.",
              retryAfterMs: minIntervalMs - (now - lastReactionAt),
            },
            429,
          );
        }

        const raw = await this.state.storage.get(REACTIONS_KEY);
        const counts = readStoredReactions(raw);
        counts[reaction] += 1;

        await this.state.storage.put(REACTIONS_KEY, JSON.stringify(counts));
        await this.state.storage.put(rateKey, `${now}`);
        return jsonResponse({ counts });
      }

      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    return jsonResponse({ error: "Not found" }, 404);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const requestedMethod =
        request.headers.get("Access-Control-Request-Method") || "GET";
      if (
        requiresAllowedOrigin(url.pathname, requestedMethod) &&
        !isAllowedOrigin(request.headers.get("Origin"), env)
      ) {
        return mergeCorsHeaders(
          jsonResponse({ error: "Forbidden origin" }, 403),
          request,
          env,
        );
      }

      return mergeCorsHeaders(
        new Response(null, { status: 204 }),
        request,
        env,
      );
    }

    if (!isKnownPath(url.pathname)) {
      return mergeCorsHeaders(
        jsonResponse({ error: "Not found" }, 404),
        request,
        env,
      );
    }

    if (
      requiresAllowedOrigin(url.pathname, request.method) &&
      !isAllowedOrigin(request.headers.get("Origin"), env)
    ) {
      return mergeCorsHeaders(
        jsonResponse({ error: "Forbidden origin" }, 403),
        request,
        env,
      );
    }

    if (url.pathname === ADMIN_VIEWS_PATH) {
      if (!getAdminToken(env)) {
        return mergeCorsHeaders(
          jsonResponse({ error: "Admin API not configured" }, 503),
          request,
          env,
        );
      }

      if (!isAuthorizedAdminRequest(request, env)) {
        return mergeCorsHeaders(
          jsonResponse({ error: "Unauthorized" }, 401),
          request,
          env,
        );
      }
    }

    if (isDiscordAppPath(url.pathname)) {
      if (request.method !== "GET") {
        return mergeCorsHeaders(
          jsonResponse({ error: "Method not allowed" }, 405),
          request,
          env,
        );
      }

      const applicationId = parseDiscordApplicationId(url.pathname);
      if (!applicationId) {
        return mergeCorsHeaders(
          jsonResponse({ error: "Invalid Discord application id" }, 400),
          request,
          env,
        );
      }

      const response = await fetchDiscordApplication(applicationId);
      return mergeCorsHeaders(response, request, env);
    }

    const counterStub = createCounterStub(env);
    if (!counterStub) {
      return mergeCorsHeaders(
        jsonResponse(
          { error: "Durable Object binding missing: PROFILE_COUNTER" },
          500,
        ),
        request,
        env,
      );
    }

    const bodyText =
      request.method === "POST" ? await request.text() : undefined;
    const durableObjectRequest = createDurableObjectRequest(
      request,
      url.pathname,
      env,
      bodyText,
    );
    const response = await counterStub.fetch(durableObjectRequest);

    return mergeCorsHeaders(response, request, env);
  },
};
