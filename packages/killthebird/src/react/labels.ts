import type { Difficulty, Locale } from "../engine/types";

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
}

export const LABELS: Record<Locale, Labels> = {
  de: {
    title: "Kill the Bird",
    score: "Punkte",
    time: "Zeit",
    reload: "Nachladen!",
    reloadHint: "Rechtsklick oder Leertaste",
    reloading: "Lädt …",
    loading: "Landschaft wird geladen …",
    start: "Spiel starten",
    howTo: [
      "Zielen mit der Maus, schießen mit Linksklick",
      "Nachladen mit Rechtsklick oder Leertaste",
      "Maus an den Rand bewegen, um zu scrollen",
      "Vollbild mit F oder dem Button unten links",
    ],
    points: { near: "nah", mid: "mittel", far: "weit", bonus: "Bonus" },
    difficulty: "Schwierigkeit",
    difficulties: { easy: "Leicht", normal: "Normal", hard: "Schwer" },
    paused: "Pause",
    resume: "Weiter",
    restart: "Zum Start",
    timeUp: "Zeit abgelaufen!",
    yourScore: "Deine Punkte",
    hits: "Treffer",
    shots: "Schüsse",
    accuracy: "Trefferquote",
    again: "Nochmal spielen",
    mute: "Ton aus",
    unmute: "Ton an",
    fullscreen: "Vollbild (F)",
    exitFullscreen: "Vollbild beenden (F)",
    error: "Das Spiel konnte nicht gestartet werden.",
  },
  en: {
    title: "Kill the Bird",
    score: "Score",
    time: "Time",
    reload: "Reload!",
    reloadHint: "Right-click or space",
    reloading: "Reloading …",
    loading: "Loading landscape …",
    start: "Start game",
    howTo: [
      "Aim with the mouse, shoot with left click",
      "Reload with right click or space",
      "Move the mouse to the edge to scroll",
      "Fullscreen with F or the button bottom left",
    ],
    points: { near: "near", mid: "middle", far: "far", bonus: "bonus" },
    difficulty: "Difficulty",
    difficulties: { easy: "Easy", normal: "Normal", hard: "Hard" },
    paused: "Paused",
    resume: "Resume",
    restart: "Back to start",
    timeUp: "Time's up!",
    yourScore: "Your score",
    hits: "Hits",
    shots: "Shots",
    accuracy: "Accuracy",
    again: "Play again",
    mute: "Mute",
    unmute: "Unmute",
    fullscreen: "Fullscreen (F)",
    exitFullscreen: "Exit fullscreen (F)",
    error: "The game could not be started.",
  },
};
