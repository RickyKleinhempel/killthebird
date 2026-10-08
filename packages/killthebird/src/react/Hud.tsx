"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Difficulty, HudState } from "../engine/types";
import type { Labels } from "./labels";

export interface HudProps {
  hud: HudState;
  labels: Labels;
  points: { near: number; mid: number; far: number; bonusMax: number };
  showFullscreenButton: boolean;
  showDifficultySelect: boolean;
  onStart(): void;
  onResume(): void;
  onReset(): void;
  onToggleMute(): void;
  onToggleFullscreen(): void;
  onSelectDifficulty(difficulty: Difficulty): void;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const INK = "#fffaf0";
const SHADOW = "0 2px 0 rgba(0,0,0,.65), 0 0 8px rgba(0,0,0,.35)";
const ACCENT = "#f4b63f";

const styles = {
  root: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    fontFamily: FONT,
    color: INK,
    userSelect: "none",
    zIndex: 5,
  },
  panel: {
    position: "absolute",
    padding: "6px 14px 8px",
    borderRadius: 12,
    background: "rgba(28, 22, 14, .55)",
    backdropFilter: "blur(2px)",
    textShadow: SHADOW,
    lineHeight: 1,
  },
  caption: { fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", opacity: 0.85 },
  value: { fontSize: 34, fontWeight: 900, fontVariantNumeric: "tabular-nums", marginTop: 4 },
  iconButton: {
    position: "absolute",
    left: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    border: "none",
    background: "rgba(28, 22, 14, .55)",
    color: INK,
    cursor: "pointer",
    pointerEvents: "auto",
    display: "grid",
    placeItems: "center",
    zIndex: 2, // stay clickable above the menu backdrop
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    padding: 16,
    background: "radial-gradient(ellipse at center, rgba(10,8,4,.35), rgba(10,8,4,.65))",
    pointerEvents: "auto",
    zIndex: 1,
  },
  card: {
    width: "min(440px, 100%)",
    padding: "24px 24px 22px",
    borderRadius: 18,
    background: "rgba(32, 26, 18, .82)",
    boxShadow: "0 18px 50px rgba(0,0,0,.45)",
    textAlign: "center",
    textShadow: "0 1px 0 rgba(0,0,0,.5)",
  },
  title: { margin: 0, fontSize: 40, fontWeight: 900, letterSpacing: "-.01em", color: ACCENT, textShadow: "0 3px 0 #6b3d10" },
  button: {
    marginTop: 18,
    padding: "12px 26px",
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: 800,
    color: "#2b1a06",
    background: `linear-gradient(${ACCENT}, #e0902a)`,
    border: "none",
    borderRadius: 999,
    boxShadow: "0 4px 0 #8a5216, 0 8px 18px rgba(0,0,0,.35)",
    cursor: "pointer",
  },
  ghostButton: {
    marginTop: 18,
    marginLeft: 10,
    padding: "12px 20px",
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: 700,
    color: INK,
    background: "rgba(255,255,255,.1)",
    border: "1px solid rgba(255,255,255,.25)",
    borderRadius: 999,
    cursor: "pointer",
  },
  list: { margin: "14px 0 0", padding: 0, listStyle: "none", fontSize: 15, lineHeight: 1.6, opacity: 0.92 },
  chips: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 14 },
  chip: { padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.1)", fontSize: 13, fontWeight: 700 },
  segments: { display: "inline-flex", marginTop: 6, padding: 3, borderRadius: 999, background: "rgba(255,255,255,.1)" },
  segment: {
    padding: "6px 14px",
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 800,
    color: INK,
    background: "transparent",
    border: "none",
    borderRadius: 999,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;

function formatTime(seconds: number): string {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Shell({ spent }: { spent: boolean }) {
  return (
    <svg width="14" height="34" viewBox="0 0 14 34" aria-hidden style={{ opacity: spent ? 0.22 : 1, transition: "opacity .15s" }}>
      <rect x="1" y="1" width="12" height="23" rx="2" fill="#c8322b" stroke="#000" strokeOpacity=".5" />
      <rect x="1" y="5" width="12" height="2" fill="#000" opacity=".18" />
      <rect x="0.5" y="23" width="13" height="10" rx="1.5" fill="#d9a441" stroke="#000" strokeOpacity=".5" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
      {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  );
}

function FullscreenIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {active ? (
        <path d="M9 3v4a2 2 0 0 1-2 2H3M21 9h-4a2 2 0 0 1-2-2V3M3 15h4a2 2 0 0 1 2 2v4M15 21v-4a2 2 0 0 1 2-2h4" />
      ) : (
        <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
      )}
    </svg>
  );
}

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

function DifficultySelect({ value, labels, onSelect }: { value: Difficulty; labels: Labels; onSelect(d: Difficulty): void }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={styles.caption}>{labels.difficulty}</div>
      <div role="radiogroup" aria-label={labels.difficulty} style={styles.segments}>
        {DIFFICULTIES.map((d) => {
          const selected = d === value;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(d)}
              style={selected ? { ...styles.segment, color: "#2b1a06", background: ACCENT, textShadow: "none" } : styles.segment}
            >
              {labels.difficulties[d]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Modal({ children }: { children: ReactNode }) {
  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>{children}</div>
    </div>
  );
}

export function Hud({
  hud,
  labels,
  points,
  showFullscreenButton,
  showDifficultySelect,
  onStart,
  onResume,
  onReset,
  onToggleMute,
  onToggleFullscreen,
  onSelectDifficulty,
}: HudProps) {
  const playing = hud.state === "playing";
  const showStats = playing || hud.state === "paused";
  const lowTime = playing && hud.timeLeft <= 10;
  const needsReload = playing && hud.shells === 0 && !hud.reloading;

  return (
    <div style={styles.root}>
      {showStats && (
        <>
          <div style={{ ...styles.panel, left: 12, top: 12 }}>
            <div style={styles.caption}>{labels.score}</div>
            <div style={styles.value}>{hud.score}</div>
          </div>
          <div style={{ ...styles.panel, right: 12, top: 12, textAlign: "right" }}>
            <div style={styles.caption}>{labels.time}</div>
            <div style={{ ...styles.value, color: lowTime ? "#ff6b5b" : INK }}>{formatTime(hud.timeLeft)}</div>
          </div>
          <div style={{ ...styles.panel, right: 12, bottom: 12, display: "flex", gap: 4, alignItems: "flex-end" }}>
            {Array.from({ length: hud.maxShells }, (_, i) => (
              <Shell key={i} spent={hud.reloading || i >= hud.shells} />
            ))}
          </div>
          {(needsReload || hud.reloading) && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 22,
                transform: "translateX(-50%)",
                textAlign: "center",
                textShadow: SHADOW,
                animation: needsReload ? "ktb-blink 0.8s steps(2, start) infinite" : undefined,
              }}
            >
              <div style={{ fontSize: 30, fontWeight: 900, color: needsReload ? "#ff6b5b" : INK }}>
                {hud.reloading ? labels.reloading : labels.reload}
              </div>
              {needsReload && <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{labels.reloadHint}</div>}
            </div>
          )}
        </>
      )}

      {hud.state !== "loading" && hud.state !== "error" && (
        <button
          type="button"
          style={styles.iconButton}
          onClick={onToggleMute}
          aria-label={hud.muted ? labels.unmute : labels.mute}
          title={hud.muted ? labels.unmute : labels.mute}
        >
          <SpeakerIcon muted={hud.muted} />
        </button>
      )}

      {showFullscreenButton && hud.fullscreenSupported && hud.state !== "loading" && (
        <button
          type="button"
          style={{ ...styles.iconButton, left: 60 }}
          onClick={onToggleFullscreen}
          aria-label={hud.fullscreen ? labels.exitFullscreen : labels.fullscreen}
          title={hud.fullscreen ? labels.exitFullscreen : labels.fullscreen}
        >
          <FullscreenIcon active={hud.fullscreen} />
        </button>
      )}

      {hud.state === "loading" && (
        <Modal>
          <h2 style={styles.title}>{labels.title}</h2>
          <p style={{ margin: "14px 0 10px", opacity: 0.9 }}>{labels.loading}</p>
          <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.15)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(hud.loadProgress * 100)}%`, background: ACCENT, transition: "width .2s" }} />
          </div>
        </Modal>
      )}

      {hud.state === "ready" && (
        <Modal>
          <h2 style={styles.title}>{labels.title}</h2>
          <ul style={styles.list}>
            {labels.howTo.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div style={styles.chips}>
            <span style={styles.chip}>{labels.points.near} · {points.near}</span>
            <span style={styles.chip}>{labels.points.mid} · {points.mid}</span>
            <span style={styles.chip}>{labels.points.far} · {points.far}</span>
            <span style={styles.chip}>{labels.points.bonus} · ≤{points.bonusMax}</span>
          </div>
          {showDifficultySelect && <DifficultySelect value={hud.difficulty} labels={labels} onSelect={onSelectDifficulty} />}
          <button type="button" style={styles.button} onClick={onStart}>
            {labels.start}
          </button>
        </Modal>
      )}

      {hud.state === "paused" && (
        <Modal>
          <h2 style={styles.title}>{labels.paused}</h2>
          <button type="button" style={styles.button} onClick={onResume}>
            {labels.resume}
          </button>
          <button type="button" style={styles.ghostButton} onClick={onReset}>
            {labels.restart}
          </button>
        </Modal>
      )}

      {hud.state === "ended" && hud.lastResult && (
        <Modal>
          <h2 style={styles.title}>{labels.timeUp}</h2>
          <div style={{ marginTop: 14, ...styles.caption }}>{labels.yourScore}</div>
          <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.05, color: INK }}>{hud.lastResult.score}</div>
          <div style={styles.chips}>
            <span style={styles.chip}>{labels.hits}: {hud.lastResult.hits}</span>
            <span style={styles.chip}>{labels.shots}: {hud.lastResult.shots}</span>
            <span style={styles.chip}>{labels.accuracy}: {Math.round(hud.lastResult.accuracy * 100)} %</span>
          </div>
          {showDifficultySelect && <DifficultySelect value={hud.difficulty} labels={labels} onSelect={onSelectDifficulty} />}
          <button type="button" style={styles.button} onClick={onStart}>
            {labels.again}
          </button>
        </Modal>
      )}

      {hud.state === "error" && (
        <Modal>
          <h2 style={{ ...styles.title, fontSize: 28 }}>{labels.error}</h2>
          {hud.error && <p style={{ marginTop: 12, opacity: 0.8 }}>{hud.error}</p>}
        </Modal>
      )}

      <style>{"@keyframes ktb-blink{to{visibility:hidden}}"}</style>
    </div>
  );
}
