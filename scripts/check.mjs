import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
    encoding: "utf8"
  });

  if (result.status !== 0) {
    const output = `${result.stdout}${result.stderr}`.trim();
    reportError(`Syntax check failed for ${relativePath}${output ? `\n${output}` : ""}`);
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
    baseDir
  );
  const cssAssets = collectRelativeLinks(
    fileContents,
    /url\(\s*["']?([^"')]+)["']?\s*\)/g,
    baseDir
  );

  for (const assetPath of [...htmlAssets, ...cssAssets]) {
    if (!existsSync(assetPath)) {
      const relativeAssetPath = path.relative(rootDir, assetPath).replaceAll("\\", "/");
      reportError(`Referenced asset is missing: ${relativeAssetPath} (from ${relativePath})`);
    }
  }
}

assertFileExists("index.html");
assertFileExists("styles.css");
assertFileExists("script.js");
assertFileExists("cloudflare-worker/src/index.js", "Cloudflare worker entry");

checkNodeSyntax("script.js");
checkNodeSyntax("cloudflare-worker/src/index.js");
checkRelativeAssets("index.html");
checkRelativeAssets("styles.css");

if (errors.length > 0) {
  console.error("Static site check failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Static site check passed.");
