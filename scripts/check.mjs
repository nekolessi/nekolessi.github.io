import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const errors = [];

function reportError(message) {
  errors.push(message);
}

function assertFileExists(relativePath, context = "Required file") {
  const absolutePath = path.resolve(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    reportError(`${context} is missing: ${relativePath}`);
  }
}

function checkNodeSyntax(relativePath) {
  const absolutePath = path.resolve(rootDir, relativePath);
  const result = spawnSync(process.execPath, ["--check", absolutePath], {
    cwd: rootDir,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const output = `${result.stdout}${result.stderr}`.trim();
    reportError(
      `Syntax check failed for ${relativePath}${output ? `\n${output}` : ""}`,
    );
  }
}

function collectRelativeLinks(fileContents, pattern, baseDir) {
  const matches = [];

  for (const match of fileContents.matchAll(pattern)) {
    const rawValue = match[1]?.trim();
    if (!rawValue) {
      continue;
    }

    if (
      rawValue.startsWith("http://") ||
      rawValue.startsWith("https://") ||
      rawValue.startsWith("//") ||
      rawValue.startsWith("data:") ||
      rawValue.startsWith("#") ||
      rawValue.startsWith("mailto:")
    ) {
      continue;
    }

    const cleanValue = rawValue.split("?")[0].split("#")[0];
    if (!cleanValue) {
      continue;
    }

    matches.push(path.resolve(baseDir, cleanValue));
  }

  return matches;
}

function checkRelativeAssets(relativePath) {
  const absolutePath = path.resolve(rootDir, relativePath);
  const baseDir = path.dirname(absolutePath);
  const fileContents = readFileSync(absolutePath, "utf8");

  const htmlAssets = collectRelativeLinks(
    fileContents,
    /\b(?:src|href)=["']([^"'<>]+)["']/g,
    baseDir,
  );
  const cssAssets = collectRelativeLinks(
    fileContents,
    /url\(\s*["']?([^"')]+)["']?\s*\)/g,
    baseDir,
  );

  for (const assetPath of [...htmlAssets, ...cssAssets]) {
    if (!existsSync(assetPath)) {
      const relativeAssetPath = path
        .relative(rootDir, assetPath)
        .replaceAll("\\", "/");
      reportError(
        `Referenced asset is missing: ${relativeAssetPath} (from ${relativePath})`,
      );
    }
  }
}

assertFileExists("index.html");
assertFileExists("styles.css");
assertFileExists("script.js");
assertFileExists("src/app.js", "Site app module");
assertFileExists("src/config.js", "Site config module");
assertFileExists("src/helpers.js", "Site helpers module");
assertFileExists("src/presence.js", "Site presence module");
assertFileExists("src/reactions.js", "Site reactions module");
assertFileExists("cloudflare-worker/src/index.js", "Cloudflare worker entry");
assertFileExists("cloudflare-worker/wrangler.toml", "Cloudflare worker config");

function readFile(relativePath) {
  return readFileSync(path.resolve(rootDir, relativePath), "utf8");
}

function checkWorkerUrlConfig() {
  const configContents = readFile("src/config.js");
  const match = configContents.match(/viewCounterWorkerUrl:\s*"([^"]*)"/);
  const configuredUrl = match?.[1]?.trim() || "";

  if (configuredUrl && !/\/views\/?$/i.test(configuredUrl)) {
    reportError(
      "APP_CONFIG.viewCounterWorkerUrl must be empty or end with /views in src/config.js",
    );
  }
}

function checkSourceModules() {
  const sourceDir = path.resolve(rootDir, "src");

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".js")) {
      checkNodeSyntax(path.posix.join("src", entry.name));
    }
  }
}

function checkWranglerConfig() {
  const wranglerContents = readFile("cloudflare-worker/wrangler.toml");

  const requiredSnippets = [
    'name = "PROFILE_COUNTER"',
    'class_name = "ProfileCounterDurableObject"',
    'new_sqlite_classes = ["ProfileCounterDurableObject"]',
  ];

  for (const snippet of requiredSnippets) {
    if (!wranglerContents.includes(snippet)) {
      reportError(`wrangler.toml is missing required setting: ${snippet}`);
    }
  }

  const allowedOriginsMatch = wranglerContents.match(
    /^ALLOWED_ORIGINS = "([^"]+)"/m,
  );
  if (!allowedOriginsMatch?.[1]?.trim()) {
    reportError("wrangler.toml must define a non-empty ALLOWED_ORIGINS value");
  }

  const intervalMatch = wranglerContents.match(
    /^REACTION_MIN_INTERVAL_MS = "([^"]+)"/m,
  );
  if (!intervalMatch?.[1] || !/^\d+$/.test(intervalMatch[1])) {
    reportError(
      "wrangler.toml must define REACTION_MIN_INTERVAL_MS as a numeric string",
    );
  }
}

checkNodeSyntax("script.js");
checkSourceModules();
checkNodeSyntax("cloudflare-worker/src/index.js");
checkRelativeAssets("index.html");
checkRelativeAssets("styles.css");
checkWorkerUrlConfig();
checkWranglerConfig();

if (errors.length > 0) {
  console.error("Static site check failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Static site check passed.");
