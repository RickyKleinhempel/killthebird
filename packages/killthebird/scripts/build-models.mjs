// Builds all GLB models from the Blender scripts and optimises them for the web.
//
//   node scripts/build-models.mjs [--only chicken,windmill] [--previews <dir>]
//
// Blender is looked up via $BLENDER_PATH, then the default Windows / macOS /
// Linux install locations, then `blender` on PATH.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Logger, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const blenderScript = join(root, "assets-src", "blender", "build_all.py");
const outDir = join(root, "assets", "models");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function findBlender() {
  if (process.env.BLENDER_PATH) return process.env.BLENDER_PATH;
  const candidates = [];
  if (process.platform === "win32") {
    const base = join(process.env.ProgramFiles ?? "C:/Program Files", "Blender Foundation");
    if (existsSync(base)) {
      for (const dir of readdirSync(base).sort().reverse()) candidates.push(join(base, dir, "blender.exe"));
    }
  } else if (process.platform === "darwin") {
    candidates.push("/Applications/Blender.app/Contents/MacOS/Blender");
  }
  return candidates.find((c) => existsSync(c)) ?? "blender";
}

const rawDir = mkdtempSync(join(tmpdir(), "killthebird-models-"));
const blender = findBlender();
const blenderArgs = ["--background", "--factory-startup", "--python", blenderScript, "--", "--out", rawDir];
if (arg("--only")) blenderArgs.push("--only", arg("--only"));
if (arg("--previews")) blenderArgs.push("--previews", resolve(arg("--previews")));

console.log(`Blender: ${blender}`);
const log = execFileSync(blender, blenderArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
for (const line of log.split(/\r?\n/)) if (line.startsWith("[models]")) console.log(line);

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

mkdirSync(outDir, { recursive: true });
let total = 0;
for (const file of readdirSync(rawDir).filter((f) => f.endsWith(".glb"))) {
  const doc = await io.read(join(rawDir, file));
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  await doc.transform(
    dedup(),
    // keepLeaves: anchor empties such as "Peek" carry no mesh but are used by the game.
    prune({ keepLeaves: true }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  const target = join(outDir, file);
  await io.write(target, doc);
  const size = statSync(target).size;
  total += size;
  const before = statSync(join(rawDir, file)).size;
  console.log(`  ${file.padEnd(16)} ${(before / 1024).toFixed(1).padStart(6)} KB -> ${(size / 1024).toFixed(1).padStart(6)} KB`);
}
rmSync(rawDir, { recursive: true, force: true });
console.log(`${arg("--only") ? "Rebuilt" : "Total"}: ${(total / 1024).toFixed(1)} KB in ${outDir}`);
