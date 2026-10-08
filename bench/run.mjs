// Frame-time benchmark.
//
//   pnpm bench -- --label before [--port 3200] [--scenarios gpu,cpu4x,swgpu] [--runs 3]
//                 [--seconds 20] [--query "&foo=1"] [--no-serve] [--no-build] [--headed]
//   pnpm bench -- --compare before after
//
// Each scenario loads the demo with ?debug&seed=7&adaptive=0 (--query "&adaptive=1"
// measures with the adaptive resolution instead), starts a round
// and drives it from inside the page: the camera sweeps across the whole
// panorama and a shot is fired every 0.4 s (with reloads), so particles and
// impacts are exercised too.
//
// Without vsync, requestAnimationFrame does not wait for the GPU, so every
// frame ends with a 1-pixel readPixels that blocks until the GPU is done:
// "frame ms" is CPU + GPU time per frame. Where EXT_disjoint_timer_query_webgl2
// is available, "gpu ms" is the GPU time of renderer.render() alone.
// Deterministic draw calls / triangles come from bench/shots.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gpuName, launchChrome, openGame, outDir, parseArgs, serveDemo, OUT } from "./lib.mjs";

const SCENARIOS = {
  gpu: { gpu: "native", width: 1920, height: 1080, cpuThrottle: 1 },
  cpu4x: { gpu: "native", width: 1920, height: 1080, cpuThrottle: 4 },
  swgpu: { gpu: "swiftshader", width: 960, height: 540, cpuThrottle: 1 },
};

const args = parseArgs();
if (args.compare) compare(...args.compare);
else await main();

async function main() {
  const label = args.label ?? "run";
  const port = Number(args.port ?? 3123);
  const runs = Number(args.runs ?? 3);
  const seconds = Number(args.seconds ?? 20);
  const scenarios = String(args.scenarios ?? "gpu,cpu4x,swgpu").split(",");
  const server = await serveDemo({ port, serve: args.serve !== false, build: args.build !== false });
  const result = { label, date: new Date().toISOString(), seconds, scenarios: {} };
  try {
    for (const name of scenarios) {
      const sc = SCENARIOS[name];
      if (!sc) throw new Error(`Unknown scenario ${name}`);
      const samples = [];
      let gpu = "";
      for (let r = 0; r < runs; r++) {
        const browser = await launchChrome({ gpu: sc.gpu, headed: args.headed === true });
        try {
          const { context, page, ready } = await openGame(browser, server.url, { width: sc.width, height: sc.height, query: args.query ?? "" });
          await ready();
          gpu = await gpuName(page);
          if (sc.cpuThrottle > 1) {
            const cdp = await context.newCDPSession(page);
            await cdp.send("Emulation.setCPUThrottlingRate", { rate: sc.cpuThrottle });
          }
          const s = await page.evaluate(measure, seconds);
          samples.push(s);
          console.log(`[bench] ${name} run ${r + 1}/${runs}: ${s.fps.toFixed(1)} fps, p95 ${s.p95.toFixed(1)} ms, gpu ${s.gpuMs?.toFixed(2) ?? "n/a"} ms (${s.frames} frames, ${gpu})`);
        } finally {
          await browser.close();
        }
      }
      result.scenarios[name] = { gpu, ...median(samples), runs: samples };
    }
  } finally {
    await server.stop();
  }
  const file = join(outDir(label), "timing.json");
  writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(`[bench] wrote ${file}`);
  printTable([result]);
}

/** Median of each metric over the runs (robust against one noisy run). */
function median(samples) {
  const out = {};
  for (const key of ["fps", "avg", "p50", "p95", "p99", "slow", "gpuMs"]) {
    const v = samples.map((s) => s[key]).filter((x) => x != null).sort((a, b) => a - b);
    if (v.length === 0) continue;
    out[key] = v[Math.floor(v.length / 2)];
  }
  return out;
}

// --- in-page functions (serialised by playwright, no closures) ---------------

/** Plays for `seconds` with a scripted camera sweep and shots; returns frame stats. */
async function measure(seconds) {
  const g = globalThis.__killthebird;
  const gl = g.renderer.getContext();
  const pixel = new Uint8Array(4);
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

  // GPU timer around renderer.render (shadow pass included).
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  const render = g.renderer.render;
  const pending = [];
  const gpuTimes = [];
  let recording = false;
  if (ext) {
    g.renderer.render = function (scene, camera) {
      if (!recording) return render.call(this, scene, camera);
      const q = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      render.call(this, scene, camera);
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(q);
    };
  }
  const collect = () => {
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = pending.shift();
      if (!disjoint) gpuTimes.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
  };

  g.start();
  const canvas = g.renderer.domElement;
  const times = [];
  let last = 0;
  let running = true;
  let warm = 0;
  const tick = (now) => {
    sync();
    const t = performance.now();
    if (recording) times.push(t - last);
    else warm++;
    last = t;
    if (ext) collect();
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  let driverStart = performance.now();
  let shot = 0;
  const driver = setInterval(() => {
    const t = (performance.now() - driverStart) / 1000;
    // right 2.5 s, left 5 s, right 2.5 s, ... covers -40..40 repeatedly
    const phase = (t + 1.25) % 10;
    g.input.keyDirection = phase < 3.75 ? 1 : phase < 8.75 ? -1 : 1;
    if (t * 2.5 > shot) {
      shot++;
      if (g.session.weapon.shells === 0) g.reload();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      g.input.x = w * (0.3 + 0.4 * ((shot * 0.37) % 1));
      g.input.y = h * (0.2 + 0.6 * ((shot * 0.61) % 1));
      g.shoot();
    }
  }, 50);

  // Warm-up (shader compilation, first uploads): at least 2 s and 20 frames.
  const warmStart = performance.now();
  while (performance.now() - warmStart < 2000 || warm < 20) await new Promise((r) => setTimeout(r, 100));
  driverStart = performance.now();
  shot = 0;
  recording = true;
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, seconds * 1000));
  // Slow devices: make sure there are enough frames for percentiles.
  while (times.length < 30 && performance.now() - t0 < seconds * 3000) await new Promise((r) => setTimeout(r, 100));
  recording = false;
  running = false;
  clearInterval(driver);
  g.input.keyDirection = 0;
  if (ext) {
    await new Promise((r) => setTimeout(r, 200));
    collect();
    g.renderer.render = render;
  }

  const sorted = [...times].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const gpuMs = gpuTimes.length ? gpuTimes.reduce((a, b) => a + b, 0) / gpuTimes.length : null;
  return {
    frames: times.length,
    fps: 1000 / avg,
    avg,
    p50: q(0.5),
    p95: q(0.95),
    p99: q(0.99),
    slow: times.filter((t) => t > 33.4).length / times.length,
    gpuMs,
  };
}

// --- reporting ------------------------------------------------------------------

function load(label) {
  return JSON.parse(readFileSync(join(OUT, label, "timing.json"), "utf8"));
}

function compare(a, b) {
  printTable([load(a), load(b)]);
}

function printTable(results) {
  const names = [...new Set(results.flatMap((r) => Object.keys(r.scenarios)))];
  const rows = [];
  for (const name of names) {
    for (const r of results) {
      const s = r.scenarios[name];
      if (!s) continue;
      rows.push({
        scenario: name,
        label: r.label,
        fps: s.fps.toFixed(1),
        "frame ms": s.avg.toFixed(2),
        "p95 ms": s.p95.toFixed(2),
        "p99 ms": s.p99.toFixed(2),
        ">33ms": `${(s.slow * 100).toFixed(1)} %`,
        "gpu ms": s.gpuMs?.toFixed(2) ?? "n/a",
      });
    }
    if (results.length === 2) {
      const [x, y] = results.map((r) => r.scenarios[name]);
      if (x && y) {
        rows.push({
          scenario: name,
          label: "Δ",
          fps: `${(((y.fps - x.fps) / x.fps) * 100).toFixed(1)} %`,
          "frame ms": `${(((y.avg - x.avg) / x.avg) * 100).toFixed(1)} %`,
          "p95 ms": `${(((y.p95 - x.p95) / x.p95) * 100).toFixed(1)} %`,
          "p99 ms": "",
          ">33ms": "",
          "gpu ms": x.gpuMs && y.gpuMs ? `${(((y.gpuMs - x.gpuMs) / x.gpuMs) * 100).toFixed(1)} %` : "",
        });
      }
    }
  }
  console.table(rows);
  for (const r of results) for (const [n, s] of Object.entries(r.scenarios)) console.log(`${r.label} ${n}: ${s.gpu}`);
}
