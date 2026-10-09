import { GameDemo } from "./GameDemo";

const REPO = "https://github.com/RickyKleinhempel/killthebird";
const NPM = "https://www.npmjs.com/package/killthebird";

const code = {
  background: "#2a251c",
  padding: "12px 14px",
  borderRadius: 8,
  overflowX: "auto",
  fontSize: 13,
  lineHeight: 1.5,
} as const;

export default function Page() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 16px" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>killthebird</h1>
        <span style={{ opacity: 0.75 }}>3D moorland shooter as a React/Next.js component</span>
        <nav style={{ marginLeft: "auto", display: "flex", gap: 14, fontSize: 14 }}>
          <a href={REPO} style={{ color: "#f4b63f" }}>GitHub</a>
          <a href={NPM} style={{ color: "#f4b63f" }}>npm</a>
        </nav>
      </header>
      <GameDemo />
      <section style={{ marginTop: 28, maxWidth: 760, fontSize: 15, lineHeight: 1.6 }}>
        <h2 style={{ fontSize: 18 }}>Add it to your own Next.js app</h2>
        <pre style={code}>{`npm install killthebird three
npx killthebird copy-assets public/killthebird`}</pre>
        <pre style={code}>{`"use client";
import { KillTheBird } from "killthebird";

export function Game() {
  return (
    <div style={{ width: "100%", aspectRatio: "16 / 9" }}>
      <KillTheBird onGameEnd={(r) => console.log(r.score)} />
    </div>
  );
}`}</pre>
        <p style={{ opacity: 0.75 }}>
          All props, events and notes on fullscreen and asset hosting are in the{" "}
          <a href={`${REPO}#readme`} style={{ color: "#f4b63f" }}>README</a>.
        </p>
      </section>
    </main>
  );
}
