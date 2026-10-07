# killthebird

A 3D moorland bird-shooting arcade game for the browser, packaged as a drop-in
React / Next.js component. Built with [three.js](https://threejs.org).

- **Real depth:** five parallax layers (foreground grass, near, middle, far hills, sky).
  Birds further away are smaller and worth more points.
- **Classic controls:** move the mouse to a screen edge to scroll the panorama,
  left click shoots, right click or space reloads. A round lasts 90 seconds and
  the gun holds 8 shells.
- **Bonus targets:** windmill, scarecrow hat, signpost, pumpkins and a chicken that
  peeks out of the deer stand.
- **Events for your app:** `onHit`, `onGameEnd` and more, so you can build
  leaderboards, raffles or analytics.
- **Hand-tuned look:** custom shaders for wind-blown grass (thousands of
  instanced blades), swaying trees, a pond with reflections and ripples,
  a sky with drifting cirrus and sun glare, aerial perspective and a soft
  vignette.
- **Small:** about 340 KB of detailed low-poly models (procedurally generated
  with Blender, vertex coloured, meshopt compressed). The engine is loaded
  lazily, so three.js stays out of your initial bundle.

**▶ [Play the demo](https://rickykleinhempel.github.io/killthebird/)**

_Deutsch: siehe [unten](#deutsch)._

## Install

```bash
npm install killthebird three
# or: pnpm add killthebird three
```

`react`, `react-dom` (>= 18.2) and `three` (>= 0.170) are peer dependencies.

### Serve the assets

The models and sounds ship inside the package under `assets/`. Copy them into a
folder your app serves statically. In Next.js that is `public/`:

```bash
npx killthebird copy-assets public/killthebird
```

To keep them in sync after updates, add the command as a pre-script:

```json
{
  "scripts": {
    "predev": "killthebird copy-assets public/killthebird",
    "prebuild": "killthebird copy-assets public/killthebird"
  }
}
```

and add `public/killthebird/` to `.gitignore`.

If you prefer a CDN, point `assetsBaseUrl` to the package on jsDelivr instead:
`assetsBaseUrl="https://cdn.jsdelivr.net/npm/killthebird@0.1.0/assets/"`.
Keep in mind that this loads files from a third-party server (privacy / GDPR).

## Use

The component fills its parent, so give the parent a size.

```tsx
// app/game/page.tsx (Server Component)
import { KillTheBird } from "killthebird";

export default function GamePage() {
  return (
    <div style={{ width: "100%", aspectRatio: "16 / 9" }}>
      <KillTheBird />
    </div>
  );
}
```

Callbacks are functions, so they need a Client Component:

```tsx
"use client";
import { KillTheBird, type GameResult } from "killthebird";

export function Game() {
  return (
    <div style={{ height: 600 }}>
      <KillTheBird
        locale="en"
        difficulty="normal"
        onHit={(e) => console.log(`+${e.points}`, e.layer, e.target)}
        onGameEnd={(result: GameResult) => saveHighscore(result.score)}
      />
    </div>
  );
}
```

### Props

| Prop | Type | Default | |
|---|---|---|---|
| `assetsBaseUrl` | `string` | `"/killthebird/"` | Where `models/` and `audio/` are served |
| `duration` | `number` | `90` | Round length in seconds |
| `shells` | `number` | `8` | Magazine size |
| `reloadTime` | `number` | `1.1` | Seconds |
| `difficulty` | `"easy" \| "normal" \| "hard"` | `"normal"` | Bird count and speed |
| `muted` | `boolean` | `false` | Controlled mute state (the HUD also has a mute button) |
| `musicVolume` / `sfxVolume` | `number` | `0.45` / `0.9` | 0..1 |
| `seed` | `number` | `7` | Landscape layout |
| `autoStart` | `boolean` | `false` | Skip the start screen |
| `locale` | `"de" \| "en"` | `"de"` | HUD language |
| `labels` | `Partial<Labels>` | | Override individual HUD texts |
| `hideHud` | `boolean` | `false` | Hide the built-in HUD and menus |
| `fullscreenButton` | `boolean` | `true` | Fullscreen toggle in the HUD (also key `F`) |
| `startFullscreen` | `boolean` | `false` | "Start game" also switches to browser fullscreen |
| `debug` | `boolean` | `false` | fps / draw call overlay |
| `maxPixelRatio` | `number` | `2` | Caps `devicePixelRatio` |
| `className` / `style` | | | Applied to the container |

### Events

| Callback | Payload |
|---|---|
| `onReady()` | Assets loaded, start screen visible |
| `onGameStart()` | A round started |
| `onShot(e)` | `{ hit, shellsLeft }` |
| `onHit(e)` | `{ points, layer: "near" \| "mid" \| "far" \| "bonus", target, totalScore, screenX, screenY }` |
| `onReload()` | Reload started |
| `onGameEnd(result)` | `{ score, hits, shots, accuracy, durationMs, hitsByLayer }` |
| `onStateChange(state)` | `"loading" \| "ready" \| "playing" \| "paused" \| "ended" \| "error"` |
| `onHudChange(hud)` | Everything the HUD shows; use it with `hideHud` for a custom HUD |
| `onError(error)` | e.g. WebGL not available |

### Imperative control

```tsx
const ref = useRef<KillTheBirdHandle>(null);
<KillTheBird ref={ref} />;
ref.current?.start(); // also: pause(), resume(), reset(), getHud()
```

Call `start()` from a user gesture (click) so the browser allows audio.

### Fullscreen

The HUD has a fullscreen button (bottom left), and `F` toggles fullscreen while
the game has focus. To offer your own button, call the ref from a click handler:

```tsx
<button
  onClick={() => {
    ref.current?.setFullscreen(true); // also: toggleFullscreen()
    ref.current?.start();
  }}
>
  Play fullscreen
</button>
```

Browsers only allow fullscreen from a user gesture. Inside an `<iframe>` the
frame needs `allow="fullscreen"`. iPhone Safari has no fullscreen API for
non-video elements, so the button is hidden there; to fill the whole window
instead, give the parent `width: 100vw; height: 100dvh`.

### Without React

```ts
import { createGame } from "killthebird/engine";

const game = createGame(document.getElementById("game")!, { difficulty: "hard" });
game.on("end", (result) => console.log(result.score));
game.start(); // from a click handler
// later: game.destroy();
```

`createGame` renders the 3D scene, crosshair and score popups, but no HUD or
menus. Build those from the `hud` event.

## Scoring

| Target | Points |
|---|---|
| Near bird | 5 |
| Middle bird | 10 |
| Far bird | 25 |
| Signpost | 10 |
| Scarecrow hat, pumpkin | 15 |
| Windmill | 25 |
| Chicken in the deer stand | 50 |

## Look and performance

| Effect | Where |
|---|---|
| Wind sway for trees, bushes, reeds, grass tufts | `shaders/patch.ts` (vertex shader patch, weight baked into `aWind` when props are merged) |
| Instanced grass field (~14k blades, 1 draw call) | `shaders/grass.ts` (`ShaderMaterial`) |
| Pond: waves, Fresnel sky reflection, sun glint, shot ripples | `shaders/water.ts` |
| Sky gradient, cirrus clouds, sun corona, dithering | `shaders/sky.ts` |
| Aerial perspective (low-ground haze, warm fog towards the sun), rim light, ground detail | `shaders/patch.ts`, `shaders/common.ts` |
| Hit flashes, vignette, film grain, muzzle flash | `shaders/impacts.ts`, `shaders/screen.ts` |

Every model uses vertex colours and one shared material, and static scenery is
merged per depth layer, so a frame needs only about 50 draw calls. Use the
`debug` prop to see fps and draw calls.

## Developing

The repository is a pnpm workspace with this package and a Next.js demo app.

```bash
pnpm install
pnpm dev            # builds the package and starts the demo on http://localhost:3123
pnpm test           # unit tests (vitest)
pnpm models         # regenerate all models with Blender (headless)
pnpm audio          # convert the CC0 sounds in assets-src/audio to MP3 (also via Blender)
```

All 3D models are generated by Python scripts in `assets-src/blender/`
(Blender 4.2+; developed with 5.2). `pnpm models` runs Blender in background
mode, exports GLB files and compresses them with meshopt via glTF-Transform.
Set `BLENDER_PATH` if Blender is not in a standard location. Add
`--previews <dir>` to render a PNG of every model.

## Credits and licenses

Code and models: MIT. Sound effects and music: see `assets/LICENSES.md`
(all CC0).

This is an independent game. It is not affiliated with, and uses no assets of,
any existing commercial game.

---

## Deutsch

`killthebird` ist ein 3D-Moorhuhn-artiges Schießspiel als React-/Next.js-Komponente.

1. Installieren: `npm install killthebird three`
2. Assets bereitstellen: `npx killthebird copy-assets public/killthebird`
   (am besten als `predev`/`prebuild`-Script, siehe oben)
3. Einbauen. Die Komponente füllt ihren Eltern-Container:

```tsx
"use client";
import { KillTheBird } from "killthebird";

export function Spiel() {
  return (
    <div style={{ width: "100%", aspectRatio: "16 / 9" }}>
      <KillTheBird onGameEnd={(r) => console.log("Punkte:", r.score)} />
    </div>
  );
}
```

Steuerung: Maus an den Rand bewegen zum Scrollen, Linksklick schießt,
Rechtsklick oder Leertaste lädt nach, `Esc` pausiert, `F` schaltet Vollbild.
Vollbild gibt es auch über den Button unten links im Spiel, per
`startFullscreen` direkt beim Start oder aus deiner App per
`ref.current?.setFullscreen(true)` (muss in einem Klick-Handler passieren). Die Texte sind
standardmäßig deutsch (`locale="de"`); mit `locale="en"` werden sie englisch.
