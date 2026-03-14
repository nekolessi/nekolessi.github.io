const COUNTER_KEY = "profile_views_total";
const COUNTER_INIT = 0;
const REACTIONS_KEY = "profile_reactions_counts";
const REACTION_IDS = ["heart"];
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS
    }
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

function getCounterKv(env) {
  if (!env || !env.PROFILE_COUNTER_KV) {
    return null;
  }

  return env.PROFILE_COUNTER_KV;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const counterKv = getCounterKv(env);
    if (!counterKv) {
      return jsonResponse({ error: "Worker KV binding missing: PROFILE_COUNTER_KV" }, 500);
    }

    if (url.pathname === "/views") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const currentRaw = await counterKv.get(COUNTER_KEY);
      const current = Number.parseInt(currentRaw ?? `${COUNTER_INIT}`, 10) || COUNTER_INIT;
      const next = current + 1;

      await counterKv.put(COUNTER_KEY, `${next}`);
      return jsonResponse({ count: next });
    }

    if (url.pathname === "/reactions") {
      if (request.method === "GET") {
        const raw = await counterKv.get(REACTIONS_KEY, "json");
        return jsonResponse({ counts: normalizeReactions(raw) });
      }

      if (request.method === "POST") {
        let payload = {};
        try {
          payload = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON payload" }, 400);
        }

        const reaction = String(payload?.reaction || "").trim();
        if (!REACTION_IDS.includes(reaction)) {
          return jsonResponse({ error: "Invalid reaction type" }, 400);
        }

        const raw = await counterKv.get(REACTIONS_KEY, "json");
        const counts = normalizeReactions(raw);
        counts[reaction] += 1;

        await counterKv.put(REACTIONS_KEY, JSON.stringify(counts));
        return jsonResponse({ counts });
      }

      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    return jsonResponse({ error: "Not found" }, 404);
  }
};
