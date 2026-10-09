import type { Labels } from "../../labels";

// French typography: narrow no-break space (U+202F) before "!" and
// no-break space (U+00A0) before ":".
// Scrolling names the arrow keys instead of A/D: the game reads physical key
// codes (KeyA/KeyD), which sit under Q/D on French AZERTY keyboards.
export default {
  title: "Kill the Bird",
  score: "Score",
  time: "Temps",
  reload: "Rechargez !",
  reloadHint: "Clic droit ou Espace",
  reloading: "Rechargement…",
  loading: "Chargement du paysage…",
  start: "Lancer la partie",
  howTo: [
    "Visez avec la souris, tirez avec le clic gauche",
    "Rechargez avec le clic droit, Espace ou R",
    "Défilement : souris au bord de l’écran ou flèches ←/→",
    "Pause avec Esc ou P, plein écran avec F",
  ],
  points: { near: "proche", mid: "moyen", far: "loin", bonus: "bonus" },
  difficulty: "Difficulté",
  difficulties: { easy: "Facile", normal: "Normal", hard: "Difficile" },
  language: "Langue",
  paused: "Pause",
  resume: "Reprendre",
  restart: "Retour au début",
  timeUp: "Temps écoulé !",
  yourScore: "Votre score",
  hits: "Touchés",
  shots: "Tirs",
  accuracy: "Précision",
  again: "Rejouer",
  mute: "Couper le son",
  unmute: "Activer le son",
  fullscreen: "Plein écran (F)",
  exitFullscreen: "Quitter le plein écran (F)",
  error: "Impossible de lancer le jeu.",
  errorWebGL: "Votre navigateur ne prend pas en charge WebGL, indispensable au jeu.",
} satisfies Labels;
