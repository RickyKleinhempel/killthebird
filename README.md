# killthebird

3D moorland bird-shooting arcade game for the browser, packaged as a drop-in
React / Next.js component (three.js).

**▶ [Play the demo](https://rickykleinhempel.github.io/killthebird/)** ·
[npm package](https://www.npmjs.com/package/killthebird) ·
[package docs](packages/killthebird/README.md)

```bash
npm install killthebird three
npx killthebird copy-assets public/killthebird
```

```tsx
"use client";
import { KillTheBird } from "killthebird";

export function Game() {
  return (
    <div style={{ width: "100%", aspectRatio: "16 / 9" }}>
      <KillTheBird onGameEnd={(r) => console.log(r.score)} />
    </div>
  );
}
```

## Repository

| Path | |
|---|---|
| `packages/killthebird` | The npm package (engine, React component, assets, Blender scripts) |
| `apps/demo` | Next.js demo app, deployed to GitHub Pages |
| `.github/workflows` | CI, npm publishing on GitHub releases, Pages deployment |

```bash
pnpm install
pnpm dev      # package build + demo on http://localhost:3123
pnpm test
pnpm models   # regenerate the 3D models with Blender (headless)
pnpm audio    # convert the CC0 sounds (via Blender's FFmpeg)
```

## Releasing

1. Bump `version` in `packages/killthebird/package.json` and commit.
2. Create a GitHub release with the tag `v<version>` (e.g. `v0.1.0`).
3. The `Publish to npm` workflow runs typecheck, tests and build, then
   publishes with npm provenance. It needs the repository secret `NPM_TOKEN`.

## License

MIT for code and models. Sounds are CC0, see
[`packages/killthebird/assets/LICENSES.md`](packages/killthebird/assets/LICENSES.md).
