"use client";

import { KillTheBird, isLocale, type GameResult, type KillTheBirdHandle, type Locale, type LocaleSetting } from "killthebird";
import { useEffect, useRef, useState } from "react";

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

const LOCALE_KEY = "killthebird-demo:locale";

function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

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
  // HUD language: ?lang=fr wins, else the language the player last picked in the
  // HUD (localStorage), else "auto" (undefined). Read after mount: the server
  // renders without the query or storage, and the first client render has to match it.
  const [locale, setLocale] = useState<LocaleSetting>();
  useEffect(() => {
    const lang = new URLSearchParams(window.location.search).get("lang");
    if (lang === "auto" || isLocale(lang)) setLocale(lang);
    else {
      const stored = readStoredLocale();
      if (stored) setLocale(stored);
    }
  }, []);
  // Remember the player's pick, and keep the `locale` prop in sync with it so a
  // later prop change can never reset the pick to a stale value.
  const pickLocale = (picked: Locale) => {
    setLocale(picked);
    try {
      localStorage.setItem(LOCALE_KEY, picked);
    } catch {
      // Storage blocked (private mode, disabled site data): just don't remember it.
    }
  };
  // ?duration=… sets the round length (bench/i18n-shots.mjs uses a short one).
  const durationParam = Number(query?.get("duration"));
  const duration = Number.isFinite(durationParam) && durationParam > 0 ? durationParam : undefined;

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
          Play fullscreen
        </button>
      </div>
      <div style={{ width: "100%", aspectRatio: "16 / 9", maxHeight: "80vh", borderRadius: 12, overflow: "hidden" }}>
        <KillTheBird
          ref={game}
          assetsBaseUrl={ASSETS}
          debug={debug}
          seed={seed}
          adaptiveQuality={adaptiveQuality}
          locale={locale}
          onLocaleChange={pickLocale}
          duration={duration}
          onGameStart={() => add("Round started")}
          onHit={(e) => add(`Hit: +${e.points} (${e.target}, ${e.layer}) → ${e.totalScore}`)}
          onGameEnd={(r) => {
            add(`Game over: ${r.score} points, ${r.hits}/${r.shots} hits`);
            setBest((b) => (!b || r.score > b.score ? r : b));
          }}
        />
      </div>
      <section style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 14 }}>
        <div>
          <strong>Best score:</strong> {best ? best.score : "–"}
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
