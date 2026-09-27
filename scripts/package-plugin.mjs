#!/usr/bin/env node
/**
 * Package a Beat Data Generator plugin repository into a release zip.
 *
 * Run from the plugin repo root. Produces a zip whose root contains
 * `manifest.json` (plus the plugin's other tracked files) and a
 * `release-meta.json` describing the artifact. Writes the archive in pure
 * Node (deflate + manual central directory) so it needs no system `zip`.
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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateRawSync } from "node:zlib";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const OUT = resolve(arg("--out", "plugin.zip"));
const META = resolve(arg("--meta", "release-meta.json"));

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

// ---- collect entries ----
const entries = [];
for (const path of tracked) {
  if (isIgnored(path)) continue;
  entries.push({ name: path, data: readFileSync(path) });
}
if (!entries.some((e) => e.name === "manifest.json")) {
  die("manifest.json was excluded by ignore rules");
}

// ---- minimal ZIP writer (method 8 deflate, UTF-8 names) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosDateTime(d = new Date()) {
  const time =
    ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) &
    0xffff;
  const date =
    (((d.getFullYear() - 1980) << 9) |
      ((d.getMonth() + 1) << 5) |
      d.getDate()) &
    0xffff;
  return { time, date };
}
function buildZip(items) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, date } = dosDateTime();
  for (const item of items) {
    const name = Buffer.from(item.name, "utf8");
    const raw = item.data;
    const crc = crc32(raw);
    const deflated = deflateRawSync(raw, { level: 9 });
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    centralParts.push(cd, name);

    offset += local.length + name.length + body.length;
  }
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(items.length, 8);
  eocd.writeUInt16LE(items.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, eocd]);
}

const zip = buildZip(entries);
writeFileSync(OUT, zip);

const sha256 = createHash("sha256").update(zip).digest("hex");
const size = zip.length;
const meta = { id, version, file: OUT, sha256, size, files: entries.length };
writeFileSync(META, `${JSON.stringify(meta, null, 2)}\n`, "utf-8");

console.log(
  `✓ packaged ${id}@${version}: ${OUT.split(/[\\/]/).pop()} (${entries.length} files, ${size} bytes)`,
);
console.log(`  sha256: ${sha256}`);
