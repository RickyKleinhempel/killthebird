// Shared helpers for the browser benchmarks: argument parsing, building and
// serving the demo, and launching the locally installed Chrome.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT = join(ROOT, "bench", "out");

/** `--port 3200 --no-serve --compare a b` -> { port: "3200", serve: false, compare: ["a", "b"] } */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    if (!a.startsWith("--")) {
      args._.push(a);
      continue;
    }
    const key = a.slice(2);
    if (key.startsWith("no-")) {
      args[key.slice(3)] = false;
    } else if (key === "compare") {
      args.compare = [argv[++i], argv[++i]];
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      args[key] = argv[++i];
    } else {
      args[key] = true;
    }
  }
  return args;
}

export function outDir(label) {
  const dir = join(OUT, label);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: true });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed with ${r.status}`);
}

async function waitForHttp(url, timeoutMs = 120_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not come up`);
}

/**
 * Builds the library and the demo (production) and starts `next start` on
 * `port`. Returns a stop function. With `serve: false` it assumes a server is
 * already running on that port.
 */
export async function serveDemo({ port, serve = true, build = true }) {
  const url = `http://localhost:${port}/`;
  if (!serve) {
    await waitForHttp(url, 10_000);
    return { url, stop: async () => {} };
  }
  if (build) {
    console.log("[bench] building killthebird + demo …");
    run("pnpm", ["--filter", "killthebird", "build"]);
    run("pnpm", ["--filter", "demo", "build"]);
  }
  console.log(`[bench] starting demo on ${url}`);
  const child = spawn("pnpm", ["--filter", "demo", "exec", "next", "start", "-p", String(port)], {
    cwd: ROOT,
    stdio: "ignore",
    shell: true,
    detached: process.platform !== "win32",
  });
  const stop = async () => {
    if (child.exitCode !== null) return;
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-child.pid, "SIGTERM");
  };
  process.on("exit", () => void stop());
  try {
    await waitForHttp(url);
  } catch (err) {
    await stop();
    throw err;
  }
  return { url, stop };
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("No Chrome found. Set CHROME_PATH.");
  return found;
}

/**
 * Launches Chrome. `gpu: "native"` uses the real GPU, `gpu: "swiftshader"`
 * the CPU rasteriser (a stand-in for a weak GPU). vsync is disabled so the
 * frame rate shows the real headroom above 60 fps.
 */
export async function launchChrome({ gpu = "native", headed = false } = {}) {
  const args = [
    "--disable-gpu-vsync",
    "--disable-frame-rate-limit",
    "--ignore-gpu-blocklist",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--autoplay-policy=no-user-gesture-required",
  ];
  if (gpu === "swiftshader") args.push("--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader");
  else args.push("--enable-gpu");
  return chromium.launch({ executablePath: findChrome(), headless: !headed, args });
}

/** Opens the demo and waits until the game reports "ready". */
export async function openGame(browser, url, { width, height, query = "" }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.error("[page error]", err.message));
  // Adaptive resolution is off unless the query asks for it (e.g. "&adaptive=1").
  const adaptive = query.includes("adaptive=") ? "" : "&adaptive=0";
  return { context, page, ready: () => waitReady(page, `${url}?debug&seed=7${adaptive}${query}`) };
}

async function waitReady(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => globalThis.__killthebird?.state === "ready", null, { timeout: 120_000, polling: 100 });
}

export function gpuName(page) {
  return page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
  });
}

export function pct(v) {
  return `${(v * 100).toFixed(2)} %`;
}
