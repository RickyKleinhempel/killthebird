// Deterministic screenshots for before/after quality comparison.
//
//   pnpm bench:shots -- --label before [--port 3200] [--no-serve] [--no-build]
//   pnpm bench:shots -- --compare before after [--threshold 0.1]
//
// The page's clock is replaced: requestAnimationFrame only fires when the
// script steps it with fixed 1/60 s timestamps and Math.random is seeded, so
// two builds that render the same image produce (near) identical pixels.
// Frames are read straight from the WebGL canvas, without the DOM HUD.
// Draw calls and triangles of each captured frame (renderer.info, shadow pass
// included) are stored in info.json and compared too.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { launchChrome, openGame, outDir, parseArgs, pct, serveDemo, OUT } from "./lib.mjs";

const VIEW = { width: 1600, height: 900 };

const args = parseArgs();
if (args.compare) compare(...args.compare);
else await main();

/** Installed before any page script runs. */
function deterministicClock() {
  let seed = 1;
  const rand = () => {
    // mulberry32
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Math.random = rand;
  let queue = [];
  let now = 1e7; // far ahead of performance.now(), so the first dt is clamped to a fixed value
  globalThis.requestAnimationFrame = (cb) => queue.push(cb);
  globalThis.cancelAnimationFrame = () => {};
  globalThis.__bench = {
    reseed(s = 1) {
      seed = s;
    },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        now += 1000 / 60;
        const cbs = queue;
        queue = [];
        for (const cb of cbs) cb(now);
      }
    },
    /** Steps one frame and grabs the canvas in the same task (drawing buffer still valid). */
    capture() {
      this.step(1);
      const r = globalThis.__killthebird.renderer;
      return { png: r.domElement.toDataURL("image/png"), calls: r.info.render.calls, triangles: r.info.render.triangles };
    },
  };
}

/** Scripted scenes; returns name -> PNG data URL. */
function scenes() {
  const b = globalThis.__bench;
  const g = globalThis.__killthebird;
  b.reseed(1);
  g.start();
  b.step(120);
  const out = {};
  for (const x of [-40, 0, 40]) {
    g.cameraController.scroll = { x, velocity: 0 };
    b.step(45);
    out[`cam${x}`] = b.capture();
  }
  // A shot into the ground in the middle: dust burst, impact flash, muzzle flash.
  g.cameraController.scroll = { x: 0, velocity: 0 };
  b.step(5);
  const canvas = g.renderer.domElement;
  g.input.x = canvas.clientWidth * 0.5;
  g.input.y = canvas.clientHeight * 0.62;
  g.shoot();
  b.step(3);
  if (g.session.weapon.shells === g.session.weapon.capacity) throw new Error("shot was not fired");
  out.shot = b.capture();
  return out;
}

async function main() {
  const label = args.label ?? "shots";
  const port = Number(args.port ?? 3123);
  const server = await serveDemo({ port, serve: args.serve !== false, build: args.build !== false });
  const dir = outDir(join(label, "shots"));
  try {
    const browser = await launchChrome({ gpu: args.gpu ?? "native", headed: args.headed === true });
    try {
      const { page, context, ready } = await openGame(browser, server.url, { ...VIEW, query: args.query ?? "" });
      await context.addInitScript(deterministicClock);
      await ready();
      const shots = await page.evaluate(scenes);
      const info = {};
      for (const [name, shot] of Object.entries(shots)) {
        writeFileSync(join(dir, `${name}.png`), Buffer.from(shot.png.split(",")[1], "base64"));
        info[name] = { calls: shot.calls, triangles: shot.triangles };
      }
      writeFileSync(join(dir, "info.json"), JSON.stringify(info, null, 2));
      console.table(info);
      console.log(`[shots] wrote ${Object.keys(shots).length} screenshots to ${dir}`);
    } finally {
      await browser.close();
    }
  } finally {
    await server.stop();
  }
}

function compare(a, b) {
  const threshold = Number(args.threshold ?? 0.1);
  const dirA = join(OUT, a, "shots");
  const dirB = join(OUT, b, "shots");
  const diffDir = outDir(join(`diff-${a}-${b}`));
  let worst = 0;
  const rows = [];
  const infoA = readInfo(dirA);
  const infoB = readInfo(dirB);
  for (const file of readdirSync(dirA).filter((f) => f.endsWith(".png"))) {
    if (!existsSync(join(dirB, file))) {
      rows.push({ shot: file, diff: "missing in " + b });
      worst = 1;
      continue;
    }
    const imgA = PNG.sync.read(readFileSync(join(dirA, file)));
    const imgB = PNG.sync.read(readFileSync(join(dirB, file)));
    if (imgA.width !== imgB.width || imgA.height !== imgB.height) {
      rows.push({ shot: file, diff: `size ${imgA.width}x${imgA.height} vs ${imgB.width}x${imgB.height}` });
      worst = 1;
      continue;
    }
    const diff = new PNG({ width: imgA.width, height: imgA.height });
    const n = pixelmatch(imgA.data, imgB.data, diff.data, imgA.width, imgA.height, { threshold });
    const share = n / (imgA.width * imgA.height);
    worst = Math.max(worst, share);
    writeFileSync(join(diffDir, file), PNG.sync.write(diff));
    const name = file.replace(/\.png$/, "");
    const [ia, ib] = [infoA[name], infoB[name]];
    rows.push({
      shot: file,
      "pixels differing": n,
      diff: pct(share),
      [`calls ${a}`]: ia?.calls,
      [`calls ${b}`]: ib?.calls,
      [`tris ${a}`]: ia ? `${(ia.triangles / 1000).toFixed(1)}k` : "",
      [`tris ${b}`]: ib ? `${(ib.triangles / 1000).toFixed(1)}k` : "",
    });
  }
  console.table(rows);
  console.log(`[shots] diff images in ${diffDir}`);
  const ok = worst <= 0.001;
  console.log(ok ? `[shots] OK: max ${pct(worst)} ≤ 0.10 %` : `[shots] FAIL: max ${pct(worst)} > 0.10 %`);
  process.exitCode = ok ? 0 : 1;
}

function readInfo(dir) {
  const file = join(dir, "info.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}
