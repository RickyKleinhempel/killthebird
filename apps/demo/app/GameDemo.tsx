"use client";

import { KillTheBird, type GameResult, type KillTheBirdHandle } from "killthebird";
import { useRef, useState } from "react";

// On GitHub Pages the app lives under a base path (see next.config.ts).
const ASSETS = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/killthebird/`;

const buttonStyle = {
  padding: "8px 16px",
  fontSize: 15,
  fontWeight: 700,
  color: "#2b1a06",
  background: "#f4b63f",
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
} as const;

export function GameDemo() {
  const game = useRef<KillTheBirdHandle>(null);
  const [log, setLog] = useState<string[]>([]);
  const [best, setBest] = useState<GameResult | null>(null);
  const add = (line: string) => setLog((l) => [line, ...l].slice(0, 8));
  const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const debug = query?.has("debug") ?? false;
  // ?seed=… makes the level reproducible (used by the benchmarks in /bench).
  const seed = query?.has("seed") ? Number(query.get("seed")) : undefined;
  // ?adaptive=0 turns the adaptive resolution off (the benchmarks measure without it).
  const adaptive = query?.get("adaptive");
  const adaptiveQuality = adaptive === "0" ? false : adaptive === "1" ? true : undefined;

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => {
            // Both calls inside the click handler: the browser allows fullscreen and audio.
            game.current?.setFullscreen(true);
            game.current?.start();
          }}
        >
          Im Vollbild starten
        </button>
      </div>
      <div style={{ width: "100%", aspectRatio: "16 / 9", maxHeight: "80vh", borderRadius: 12, overflow: "hidden" }}>
        <KillTheBird
          ref={game}
          assetsBaseUrl={ASSETS}
          debug={debug}
          seed={seed}
          adaptiveQuality={adaptiveQuality}
          onGameStart={() => add("Runde gestartet")}
          onHit={(e) => add(`Treffer: +${e.points} (${e.target}, ${e.layer}) → ${e.totalScore}`)}
          onGameEnd={(r) => {
            add(`Ende: ${r.score} Punkte, ${r.hits}/${r.shots} Treffer`);
            setBest((b) => (!b || r.score > b.score ? r : b));
          }}
        />
      </div>
      <section style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 14 }}>
        <div>
          <strong>Bestwert:</strong> {best ? best.score : "–"}
        </div>
        <ol style={{ margin: 0, paddingLeft: 18, opacity: 0.8 }}>
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </section>
    </>
  );
}
