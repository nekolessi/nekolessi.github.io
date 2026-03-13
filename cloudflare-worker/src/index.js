const COUNTER_KEY = "profile_views_total";
const COUNTER_INIT = 0;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);
    if (url.pathname !== "/views") {
      return jsonResponse({ error: "Not found" }, 404);
    }

    const currentRaw = await env.PROFILE_COUNTER_KV.get(COUNTER_KEY);
    const current = Number.parseInt(currentRaw ?? `${COUNTER_INIT}`, 10) || COUNTER_INIT;
    const next = current + 1;

    await env.PROFILE_COUNTER_KV.put(COUNTER_KEY, `${next}`);

    return jsonResponse({ count: next });
  }
};
