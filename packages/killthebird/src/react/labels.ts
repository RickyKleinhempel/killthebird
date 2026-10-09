import type { Difficulty } from "../engine/types";
import de from "./i18n/locales/de";
import en from "./i18n/locales/en";

/** Every text the built-in HUD shows. Each locale in `i18n/locales/` provides all of them. */
export interface Labels {
  title: string;
  score: string;
  time: string;
  reload: string;
  reloadHint: string;
  reloading: string;
  loading: string;
  start: string;
  howTo: string[];
  points: { near: string; mid: string; far: string; bonus: string };
  difficulty: string;
  difficulties: Record<Difficulty, string>;
  /** Caption of the language selector. */
  language: string;
  paused: string;
  resume: string;
  restart: string;
  timeUp: string;
  yourScore: string;
  hits: string;
  shots: string;
  accuracy: string;
  again: string;
  mute: string;
  unmute: string;
  fullscreen: string;
  exitFullscreen: string;
  error: string;
  /** Shown below `error` when the browser has no WebGL. */
  errorWebGL: string;
}

/**
 * The texts bundled with the main entry. All other locales are loaded on
 * demand; use `loadLabels(locale)` to get them.
 */
export const LABELS: Record<"de" | "en", Labels> = { de, en };
