// Public types shared by the engine and the React wrapper.
// This file must stay free of runtime imports (especially three.js) so the
// React entry can import it without pulling the engine into the main bundle.

export type BirdLayer = "near" | "mid" | "far";
export type HitLayer = BirdLayer | "bonus";
export type Difficulty = "easy" | "normal" | "hard";
export type Locale = "de" | "en";
export type GameState = "loading" | "ready" | "playing" | "paused" | "ended" | "error";

export type BonusKind = "windmill" | "scarecrow" | "signpost" | "pumpkin" | "peekaboo";

export interface GameOptions {
  /** URL prefix the assets are served from. Default: "/killthebird/". */
  assetsBaseUrl?: string;
  /** Round length in seconds. Default: 90. */
  duration?: number;
  /** Shells per magazine. Default: 8. */
  shells?: number;
  /** Reload time in seconds. Default: 1.1. */
  reloadTime?: number;
  /** Bird density and speed. Default: "normal". */
  difficulty?: Difficulty;
  /** Start muted. Default: false. */
  muted?: boolean;
  /** 0..1. Default: 0.45. */
  musicVolume?: number;
  /** 0..1. Default: 0.9. */
  sfxVolume?: number;
  /** Seed for the landscape layout. Default: 7. */
  seed?: number;
  /** Start the round as soon as assets are loaded (no start screen). Default: false. */
  autoStart?: boolean;
  /** Show fps / draw-call overlay. Default: false. */
  debug?: boolean;
  /** Upper bound for devicePixelRatio. Default: 2. */
  maxPixelRatio?: number;
}

export interface HitEvent {
  points: number;
  layer: HitLayer;
  /** "bird" or the bonus kind that was hit. */
  target: "bird" | BonusKind;
  totalScore: number;
  /** Position relative to the game container, in CSS pixels. */
  screenX: number;
  screenY: number;
}

export interface ShotEvent {
  hit: boolean;
  shellsLeft: number;
}

export interface GameResult {
  score: number;
  hits: number;
  shots: number;
  /** hits / shots, 0..1 (0 when no shot was fired). */
  accuracy: number;
  durationMs: number;
  /** Hits per layer, useful for achievements. */
  hitsByLayer: Record<HitLayer, number>;
}

export interface HudState {
  state: GameState;
  score: number;
  shells: number;
  maxShells: number;
  reloading: boolean;
  timeLeft: number;
  duration: number;
  /** 0..1 while loading. */
  loadProgress: number;
  muted: boolean;
  /** The game container is in browser fullscreen. */
  fullscreen: boolean;
  /** False e.g. on iPhone Safari or in iframes without allow="fullscreen". */
  fullscreenSupported: boolean;
  lastResult: GameResult | null;
  error: string | null;
}

export interface GameEvents {
  hud: HudState;
  state: GameState;
  start: void;
  shot: ShotEvent;
  hit: HitEvent;
  reload: void;
  end: GameResult;
  error: Error;
}

export interface GameInstance {
  readonly state: GameState;
  on<K extends keyof GameEvents>(event: K, listener: (payload: GameEvents[K]) => void): () => void;
  /** Starts a new round (from "ready" or "ended"). Call from a user gesture so audio can unlock. */
  start(): void;
  pause(): void;
  resume(): void;
  /** Abort the current round and return to the start screen. */
  reset(): void;
  setMuted(muted: boolean): void;
  /** Browser fullscreen for the game container. Call from a user gesture. */
  setFullscreen(on: boolean): void;
  toggleFullscreen(): void;
  getHud(): HudState;
  destroy(): void;
}
