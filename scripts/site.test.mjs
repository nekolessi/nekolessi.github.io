import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseHTML } from "linkedom";

import { PROFILE, UI_TEXT } from "../src/config.js";
import { createSiteApp } from "../src/app.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const html = readFileSync(path.resolve(rootDir, "index.html"), "utf8");

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : "";
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function createDocument() {
  const { document } = parseHTML(html);
  return document;
}

test("site app renders config-driven profile content and live data", async () => {
  const documentRef = createDocument();
  const intervals = [];
  const fetchImpl = async (input) => {
    const url = String(input);

    if (url.endsWith("/views")) {
      return Response.json({ count: 321 });
    }

    if (url.endsWith("/reactions")) {
      return Response.json({ counts: { heart: 5 } });
    }

    if (url.includes("api.lanyard.rest")) {
      return Response.json({
        success: true,
        data: {
          discord_status: "online",
          listening_to_spotify: true,
          discord_user: {
            id: "1116207043544612985",
            username: "nekolessi",
            global_name: "Nekolessi",
            avatar: "avatarhash",
          },
          spotify: {
            song: "Catgirl Anthem",
            artist: "Neko Artist",
            album: "Midnight Meows",
            album_art_url: "https://cdn.example.test/cover.png",
            timestamps: {
              start: 1000,
              end: 5000,
            },
          },
          activities: [],
        },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const app = createSiteApp({
    documentRef,
    fetchImpl,
    setIntervalImpl(callback, delay) {
      intervals.push({ callback, delay });
      return intervals.length;
    },
    clearIntervalImpl() {},
    localStorageImpl: createStorage(),
  });

  await app.init();

  assert.equal(
    documentRef.getElementById("profileLocation").textContent,
    PROFILE.location,
  );
  assert.equal(
    documentRef.querySelectorAll("#socialLinks a").length,
    PROFILE.links.length,
  );
  assert.equal(documentRef.getElementById("profileViews").textContent, "321");
  assert.equal(documentRef.querySelector(".reaction-count").textContent, "5");
  assert.match(
    documentRef.getElementById("discordStatusLink").href,
    /discord\.com\/users\/1116207043544612985$/,
  );
  assert.equal(
    documentRef.getElementById("discordName").textContent,
    "NEKOLESSI",
  );
  assert.equal(
    documentRef.getElementById("activityTitle").textContent,
    "Catgirl Anthem",
  );
  assert.equal(
    documentRef.getElementById("activitySubtitle").textContent,
    "Neko Artist - Midnight Meows",
  );
  assert.ok(intervals.some((entry) => entry.delay === 20_000));
  assert.ok(intervals.some((entry) => entry.delay === 1000));

  app.destroy();
});

test("site app falls back cleanly when Discord presence cannot be loaded", async () => {
  const documentRef = createDocument();
  const fetchImpl = async (input) => {
    const url = String(input);

    if (url.endsWith("/views")) {
      return Response.json({ count: 7 });
    }

    if (url.endsWith("/reactions")) {
      return Response.json({ counts: { heart: 1 } });
    }

    if (url.includes("api.lanyard.rest")) {
      throw new Error("Lanyard offline");
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const app = createSiteApp({
    documentRef,
    fetchImpl,
    setIntervalImpl() {
      return 1;
    },
    clearIntervalImpl() {},
    localStorageImpl: createStorage(),
  });

  await app.init();

  assert.equal(
    documentRef.getElementById("discordStatusText").textContent,
    UI_TEXT.statusUnavailable,
  );
  assert.equal(
    documentRef.getElementById("activityTitle").textContent,
    UI_TEXT.activityEmptyTitle,
  );
  assert.equal(
    documentRef.getElementById("activitySubtitle").textContent,
    UI_TEXT.activityDisconnectedSubtitle,
  );

  app.destroy();
});
