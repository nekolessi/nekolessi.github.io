import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  ProfileCounterDurableObject,
} from "../cloudflare-worker/src/index.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  async get(key) {
    if (!this.values.has(key)) {
      return null;
    }

    const value = this.values.get(key);
    return typeof value === "string" ? value : structuredClone(value);
  }

  async put(key, value) {
    this.values.set(key, structuredClone(value));
  }
}

class MemoryDurableObjectState {
  constructor() {
    this.storage = new MemoryStorage();
  }
}

class DurableObjectNamespaceStub {
  constructor(factory) {
    this.factory = factory;
    this.instances = new Map();
  }

  idFromName(name) {
    return name;
  }

  get(id) {
    if (!this.instances.has(id)) {
      this.instances.set(id, this.factory());
    }

    const instance = this.instances.get(id);
    return {
      fetch(request) {
        return instance.fetch(request);
      },
    };
  }
}

function createEnv(overrides = {}) {
  return {
    ALLOWED_ORIGINS: "https://nekolessi.github.io",
    REACTION_MIN_INTERVAL_MS: "10000",
    ADMIN_API_TOKEN: "super-secret-token",
    PROFILE_COUNTER: new DurableObjectNamespaceStub(
      () => new ProfileCounterDurableObject(new MemoryDurableObjectState()),
    ),
    ...overrides,
  };
}

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("views increment through the Durable Object and return CORS headers", async () => {
  const env = createEnv();
  const requestHeaders = { Origin: "https://nekolessi.github.io" };

  const firstResponse = await worker.fetch(
    new Request("https://worker.example/views", { headers: requestHeaders }),
    env,
  );
  assert.equal(firstResponse.status, 200);
  assert.equal(
    firstResponse.headers.get("Access-Control-Allow-Origin"),
    requestHeaders.Origin,
  );
  assert.deepEqual(await readJson(firstResponse), { count: 1 });

  const secondResponse = await worker.fetch(
    new Request("https://worker.example/views", { headers: requestHeaders }),
    env,
  );
  assert.equal(secondResponse.status, 200);
  assert.deepEqual(await readJson(secondResponse), { count: 2 });
});

test("views reject requests from unapproved origins", async () => {
  const env = createEnv();

  const response = await worker.fetch(
    new Request("https://worker.example/views", {
      headers: { Origin: "https://evil.example" },
    }),
    env,
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await readJson(response), { error: "Forbidden origin" });
});

test("views allow configured origins even when env values include trailing slashes", async () => {
  const env = createEnv({
    ALLOWED_ORIGINS: "https://nekolessi.github.io/, https://cute.example/",
  });

  const response = await worker.fetch(
    new Request("https://worker.example/views", {
      headers: { Origin: "https://cute.example" },
    }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://cute.example",
  );
  assert.deepEqual(await readJson(response), { count: 1 });
});

test("admin views can read and reset the counter with a bearer token", async () => {
  const env = createEnv();
  const adminHeaders = {
    Authorization: `Bearer ${env.ADMIN_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  await worker.fetch(
    new Request("https://worker.example/views", {
      headers: { Origin: "https://nekolessi.github.io" },
    }),
    env,
  );
  await worker.fetch(
    new Request("https://worker.example/views", {
      headers: { Origin: "https://nekolessi.github.io" },
    }),
    env,
  );

  const readResponse = await worker.fetch(
    new Request("https://worker.example/admin/views", {
      headers: adminHeaders,
    }),
    env,
  );
  assert.equal(readResponse.status, 200);
  assert.deepEqual(await readJson(readResponse), { count: 2 });

  const resetResponse = await worker.fetch(
    new Request("https://worker.example/admin/views", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ count: 300 }),
    }),
    env,
  );
  assert.equal(resetResponse.status, 200);
  assert.deepEqual(await readJson(resetResponse), { count: 300 });

  const confirmResponse = await worker.fetch(
    new Request("https://worker.example/admin/views", {
      headers: adminHeaders,
    }),
    env,
  );
  assert.equal(confirmResponse.status, 200);
  assert.deepEqual(await readJson(confirmResponse), { count: 300 });
});

test("admin views reject missing or invalid tokens", async () => {
  const env = createEnv();

  const unauthorizedResponse = await worker.fetch(
    new Request("https://worker.example/admin/views"),
    env,
  );
  assert.equal(unauthorizedResponse.status, 401);
  assert.deepEqual(await readJson(unauthorizedResponse), {
    error: "Unauthorized",
  });

  const invalidCountResponse = await worker.fetch(
    new Request("https://worker.example/admin/views", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.ADMIN_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ count: -1 }),
    }),
    env,
  );
  assert.equal(invalidCountResponse.status, 400);
  assert.deepEqual(await readJson(invalidCountResponse), {
    error: "Invalid count",
  });
});

test("reaction posts require an approved origin and are rate limited per IP", async () => {
  const env = createEnv();
  const allowedHeaders = {
    Origin: "https://nekolessi.github.io",
    "Content-Type": "application/json",
    "CF-Connecting-IP": "203.0.113.9",
  };

  const firstResponse = await worker.fetch(
    new Request("https://worker.example/reactions", {
      method: "POST",
      headers: allowedHeaders,
      body: JSON.stringify({ reaction: "heart" }),
    }),
    env,
  );
  assert.equal(firstResponse.status, 200);
  assert.deepEqual(await readJson(firstResponse), { counts: { heart: 1 } });

  const rateLimitedResponse = await worker.fetch(
    new Request("https://worker.example/reactions", {
      method: "POST",
      headers: allowedHeaders,
      body: JSON.stringify({ reaction: "heart" }),
    }),
    env,
  );
  assert.equal(rateLimitedResponse.status, 429);
  const rateLimitedPayload = await readJson(rateLimitedResponse);
  assert.equal(
    rateLimitedPayload.error,
    "Too many reactions. Try again shortly.",
  );
  assert.match(`${rateLimitedPayload.retryAfterMs}`, /^\d+$/);

  const blockedOriginResponse = await worker.fetch(
    new Request("https://worker.example/reactions", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: JSON.stringify({ reaction: "heart" }),
    }),
    env,
  );
  assert.equal(blockedOriginResponse.status, 403);
  assert.deepEqual(await readJson(blockedOriginResponse), {
    error: "Forbidden origin",
  });
});

test("reaction counts can still be read after a successful post", async () => {
  const env = createEnv();

  await worker.fetch(
    new Request("https://worker.example/reactions", {
      method: "POST",
      headers: {
        Origin: "https://nekolessi.github.io",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "198.51.100.7",
      },
      body: JSON.stringify({ reaction: "heart" }),
    }),
    env,
  );

  const response = await worker.fetch(
    new Request("https://worker.example/reactions"),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), { counts: { heart: 1 } });
});

test("discord app lookup proxies Discord metadata through the worker", async () => {
  const env = createEnv();
  const originalFetch = globalThis.fetch;
  const applicationId = "1445976703066443846";

  globalThis.fetch = async (input) => {
    assert.equal(
      String(input),
      `https://discord.com/api/v10/oauth2/applications/${applicationId}/rpc`,
    );
    return new Response(
      JSON.stringify({
        id: applicationId,
        name: "On-Together",
        icon: "32860963bf693a92ab6a52ee5cb40b12",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  try {
    const response = await worker.fetch(
      new Request(`https://worker.example/discord-app/${applicationId}`, {
        headers: { Origin: "https://nekolessi.github.io" },
      }),
      env,
    );

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://nekolessi.github.io",
    );
    assert.equal(
      response.headers.get("Cache-Control"),
      "public, max-age=86400",
    );
    assert.deepEqual(await readJson(response), {
      id: applicationId,
      name: "On-Together",
      iconUrl: `https://cdn.discordapp.com/app-icons/${applicationId}/32860963bf693a92ab6a52ee5cb40b12.png?size=256`,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("discord app lookup rejects invalid ids and blocked origins", async () => {
  const env = createEnv();

  const invalidResponse = await worker.fetch(
    new Request("https://worker.example/discord-app/not-an-id", {
      headers: { Origin: "https://nekolessi.github.io" },
    }),
    env,
  );
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await readJson(invalidResponse), {
    error: "Invalid Discord application id",
  });

  const blockedOriginResponse = await worker.fetch(
    new Request("https://worker.example/discord-app/1445976703066443846", {
      headers: { Origin: "https://evil.example" },
    }),
    env,
  );
  assert.equal(blockedOriginResponse.status, 403);
  assert.deepEqual(await readJson(blockedOriginResponse), {
    error: "Forbidden origin",
  });
});
