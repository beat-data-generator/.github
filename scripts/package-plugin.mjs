#!/usr/bin/env node
/**
 * Package a Beat Data Generator plugin repository into a release zip.
 *
 * Run from the plugin repo root. Produces a zip whose root contains
 * `manifest.json` (plus the plugin's other tracked files) and a
 * `release-meta.json` describing the artifact.
 *
 * Excluded by default: `.github/`, VCS/dotfiles and `node_modules`. Extra
 * patterns can be listed one per line in `.pluginignore` (gitignore-like:
 * `#` comments, `dir/`, `*`, `**`, `?`).
 *
 * Usage:
 *   node package-plugin.mjs [--out plugin.zip] [--meta release-meta.json]
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const OUT = resolve(arg("--out", "plugin.zip"));
const META = resolve(arg("--meta", "release-meta.json"));
const STAGE = ".bdg-package";

const ID_RE = /^[A-Za-z0-9._-]+$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function die(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

// ---- validate manifest ----
if (!existsSync("manifest.json")) {
  die("manifest.json not found (run this from the plugin repo root)");
}
let manifest;
try {
  manifest = JSON.parse(readFileSync("manifest.json", "utf-8"));
} catch (err) {
  die(`invalid manifest.json: ${err.message}`);
}

const id = typeof manifest.id === "string" ? manifest.id.trim() : "";
if (!id) die("manifest.id is required");
if (!ID_RE.test(id)) die(`invalid manifest.id "${id}" (allowed: A-Za-z0-9._-)`);
if (id.includes(":")) die("manifest.id must not contain ':'");
const version = typeof manifest.version === "string" ? manifest.version : "";
if (!SEMVER_RE.test(version))
  die(`invalid manifest.version "${manifest.version}"`);
if (!manifest.name) console.warn("! manifest.name is missing");
if (!manifest.description) console.warn("! manifest.description is missing");
for (const entry of [manifest.main, manifest.renderer]) {
  if (entry && !existsSync(entry))
    die(`entry "${entry}" listed in manifest.json is missing`);
}

// ---- collect tracked files ----
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf-8" })
  .split("\0")
  .filter(Boolean)
  .map((p) => p.replace(/\\/g, "/"));

// ---- ignore rules ----
const DEFAULT_IGNORES = [
  ".github/",
  ".gitignore",
  ".gitattributes",
  ".pluginignore",
  ".editorconfig",
  "node_modules/",
];
const patterns = [...DEFAULT_IGNORES];
if (existsSync(".pluginignore")) {
  for (const line of readFileSync(".pluginignore", "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith("#")) patterns.push(t);
  }
}

function globToRegex(glob) {
  return glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*")
    .replace(/\?/g, "[^/]");
}

function isIgnored(path) {
  for (const raw of patterns) {
    let p = raw.replace(/\\/g, "/").replace(/^\.\//, "");
    if (p.startsWith("/")) p = p.slice(1);
    const dirOnly = p.endsWith("/");
    if (dirOnly) p = p.slice(0, -1);
    if (!p) continue;
    const tail = dirOnly ? "/" : "($|/)";
    const re = p.includes("/")
      ? new RegExp(`^${globToRegex(p)}${tail}`)
      : new RegExp(`(^|/)${globToRegex(p)}${tail}`);
    if (re.test(path)) return true;
  }
  return false;
}

// ---- stage ----
rmSync(STAGE, { recursive: true, force: true });
let files = 0;
for (const path of tracked) {
  if (isIgnored(path)) continue;
  const dest = join(STAGE, path);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(path, dest);
  files++;
}
if (!existsSync(join(STAGE, "manifest.json"))) {
  die("manifest.json was excluded by ignore rules");
}

// ---- zip (manifest.json at the archive root) ----
rmSync(OUT, { force: true });
execFileSync("zip", ["-r", "-X", "-q", OUT, "."], { cwd: STAGE });
rmSync(STAGE, { recursive: true, force: true });

const buf = readFileSync(OUT);
const sha256 = createHash("sha256").update(buf).digest("hex");
const size = statSync(OUT).size;
const meta = { id, version, file: OUT, sha256, size, files };
writeFileSync(META, `${JSON.stringify(meta, null, 2)}\n`, "utf-8");

console.log(
  `✓ packaged ${id}@${version}: ${OUT.split(/[\\/]/).pop()} (${files} files, ${size} bytes)`,
);
console.log(`  sha256: ${sha256}`);
