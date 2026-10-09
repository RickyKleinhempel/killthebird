// Screenshots of the HUD menus per language, plus a layout check for text that
// overflows its box or the game area.
//
//   node bench/i18n-shots.mjs --lang fr,ja,ar [--port 3123] [--no-build] [--no-serve]
//                             [--width 1280 --height 720] [--headed]
//
// Writes bench/out/i18n/<lang>-{start,pause,end}.png and exits with 1 if any
// layout problem was found.
import { join } from "node:path";
import { launchChrome, openGame, outDir, parseArgs, serveDemo } from "./lib.mjs";

const args = parseArgs();
const port = Number(args.port ?? 3123);
const width = Number(args.width ?? 1280);
const height = Number(args.height ?? 720);
const langs = String(args.lang ?? "de,en")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Runs in the page: elements whose content overflows, or that stick out of the HUD. */
function findOverflow() {
  const root = document.querySelector("[data-ktb-hud]");
  if (!root) return ["HUD root not found"];
  const box = root.getBoundingClientRect();
  const problems = [];
  const describe = (el) => {
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    return `<${el.tagName.toLowerCase()}> "${text}"`;
  };
  for (const el of root.querySelectorAll("*")) {
    if (el.closest("svg") || el.tagName === "STYLE" || el.tagName === "OPTION") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
      problems.push(`${describe(el)} overflows horizontally (${el.scrollWidth} > ${el.clientWidth}px)`);
    }
    if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== "visible") {
      problems.push(`${describe(el)} overflows vertically (${el.scrollHeight} > ${el.clientHeight}px)`);
    }
    if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1) {
      problems.push(`${describe(el)} sticks out of the game area`);
    }
  }
  return problems;
}

const { url, stop } = await serveDemo({ port, serve: args.serve !== false, build: args.build !== false });
const browser = await launchChrome({ headed: args.headed === true });
const dir = outDir("i18n");
const report = [];

try {
  for (const lang of langs) {
    const { context, page, ready } = await openGame(browser, url, {
      width,
      height,
      query: `&lang=${encodeURIComponent(lang)}&duration=3`,
    });
    const problems = [];
    page.on("pageerror", (err) => problems.push(`page error: ${err.message}`));
    await ready();
    // Non-bundled locales load lazily; the HUD sets lang once their texts are in.
    await page.waitForSelector(`[data-ktb-hud][lang="${lang}"]`, { timeout: 15_000 }).catch(() => {
      problems.push(`HUD never switched to lang="${lang}"`);
    });
    const hud = page.locator("[data-ktb-hud]");
    const shot = async (screen) => {
      await page.waitForTimeout(250);
      await hud.screenshot({ path: join(dir, `${lang}-${screen}.png`) });
      for (const p of await page.evaluate(findOverflow)) problems.push(`${screen}: ${p}`);
    };
    const state = (s) =>
      page.waitForFunction((s) => globalThis.__killthebird?.state === s, s, { timeout: 30_000, polling: 50 });

    await shot("start");
    await page.evaluate(() => globalThis.__killthebird.start());
    await state("playing");
    await page.evaluate(() => globalThis.__killthebird.pause());
    await state("paused");
    await shot("pause");
    await page.evaluate(() => globalThis.__killthebird.resume());
    await state("ended");
    await shot("end");

    await context.close();
    report.push({ lang, problems });
    console.log(problems.length ? `✗ ${lang}\n  ${problems.join("\n  ")}` : `✓ ${lang}`);
  }
} finally {
  await browser.close();
  await stop();
}

console.log(`\nScreenshots: ${dir}`);
const failed = report.filter((r) => r.problems.length);
if (failed.length) {
  console.log(`${failed.length}/${report.length} languages with layout problems: ${failed.map((r) => r.lang).join(", ")}`);
  process.exit(1);
}
