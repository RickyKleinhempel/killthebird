#!/usr/bin/env node
// killthebird CLI: copies the game assets (models, audio) into a directory that
// your web app serves statically, e.g. Next.js `public/killthebird`.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, "..", "assets");

const HELP = `Usage: killthebird copy-assets [target-dir]

Copies the game assets into [target-dir] (default: public/killthebird).
Serve that directory and pass its URL as the "assetsBaseUrl" prop
(default "/killthebird/").`;

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    n += statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

const [command, target = "public/killthebird"] = process.argv.slice(2);

if (command !== "copy-assets") {
  console.log(HELP);
  process.exit(command === undefined || command === "--help" || command === "-h" ? 0 : 1);
}

if (!existsSync(assetsDir)) {
  console.error(`killthebird: assets directory not found at ${assetsDir}`);
  process.exit(1);
}

const dest = resolve(process.cwd(), target);
mkdirSync(dest, { recursive: true });
cpSync(assetsDir, dest, { recursive: true, force: true });
console.log(`killthebird: copied ${countFiles(assetsDir)} asset files to ${relative(process.cwd(), dest) || "."}`);
