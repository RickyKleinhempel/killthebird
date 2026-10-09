"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type {
  Difficulty,
  GameInstance,
  GameOptions,
  GameResult,
  GameState,
  HitEvent,
  HudState,
  Locale,
  LocaleSetting,
  ShotEvent,
} from "../engine/types";
import { Hud } from "./Hud";
import { browserLanguages, isLocale, localeDir, resolveLocale } from "./i18n/registry";
import { useLabels } from "./i18n/useLabels";
import type { Labels } from "./labels";

export interface KillTheBirdProps extends GameOptions {
  /**
   * HUD language. "auto" picks the browser language (English if it is not
   * supported). Players can switch it in the HUD; changing this prop resets
   * their pick. Default: "auto".
   */
  locale?: LocaleSetting;
  /** Override single HUD texts (applies to every language). */
  labels?: Partial<Labels>;
  /** Hide the built-in HUD and menus (use the events / ref to build your own). */
  hideHud?: boolean;
  /** Show the fullscreen button in the HUD. Default: true. */
  fullscreenButton?: boolean;
  /** The start / play-again button also switches to browser fullscreen. Default: false. */
  startFullscreen?: boolean;
  /** Show the difficulty selector on the start and end screen. Default: true. */
  difficultySelect?: boolean;
  /** Show the language selector on the start, pause and end screen. Default: true. */
  languageSelect?: boolean;
  className?: string;
  style?: CSSProperties;
  onReady?(): void;
  onGameStart?(): void;
  onShot?(event: ShotEvent): void;
  onHit?(event: HitEvent): void;
  onReload?(): void;
  onGameEnd?(result: GameResult): void;
  onStateChange?(state: GameState): void;
  /** The player picked another difficulty in the HUD. */
  onDifficultyChange?(difficulty: Difficulty): void;
  /** The player picked another language in the HUD. */
  onLocaleChange?(locale: Locale): void;
  onHudChange?(hud: HudState): void;
  onError?(error: Error): void;
}

export interface KillTheBirdHandle {
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  setDifficulty(difficulty: Difficulty): void;
  setLocale(locale: Locale): void;
  /** Call from a user gesture (e.g. your own button's onClick). */
  setFullscreen(on: boolean): void;
  toggleFullscreen(): void;
  getHud(): HudState | null;
}

const INITIAL_HUD: HudState = {
  state: "loading",
  score: 0,
  shells: 8,
  maxShells: 8,
  reloading: false,
  timeLeft: 90,
  duration: 90,
  loadProgress: 0,
  muted: false,
  difficulty: "normal",
  fullscreen: false,
  fullscreenSupported: false,
  lastResult: null,
  error: null,
  errorCode: null,
};

// Kept in sync with engine/config.ts without importing the engine (and three.js)
// into the main bundle.
const POINTS = { near: 5, mid: 10, far: 25, bonusMax: 50 };

/**
 * The game as a React client component. It fills its parent; give the parent
 * (or `className` / `style`) a height. The 3D engine is loaded lazily on the
 * client, so this component is safe to render from server components too.
 */
export const KillTheBird = forwardRef<KillTheBirdHandle, KillTheBirdProps>(function KillTheBird(props, ref) {
  const {
    assetsBaseUrl,
    duration,
    shells,
    reloadTime,
    difficulty,
    muted,
    musicVolume,
    sfxVolume,
    seed,
    autoStart,
    debug,
    maxPixelRatio,
    adaptiveQuality,
    locale: localeSetting = "auto",
    labels: labelOverrides,
    hideHud = false,
    fullscreenButton = true,
    startFullscreen = false,
    difficultySelect = true,
    languageSelect = true,
    className,
    style,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameInstance | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [hud, setHud] = useState<HudState>(() => ({
    ...INITIAL_HUD,
    shells: shells ?? INITIAL_HUD.shells,
    maxShells: shells ?? INITIAL_HUD.maxShells,
    timeLeft: duration ?? INITIAL_HUD.timeLeft,
    duration: duration ?? INITIAL_HUD.duration,
    muted: muted ?? false,
    difficulty: difficulty ?? INITIAL_HUD.difficulty,
  }));
  const mutedRef = useRef(muted ?? false);
  // Survives game re-creation, so the player's pick is kept.
  const difficultyRef = useRef<Difficulty>(difficulty ?? INITIAL_HUD.difficulty);

  // "auto" is resolved after mount: the server cannot know the browser
  // language, and the first client render has to match the server's.
  const [locale, setLocale] = useState<Locale>(() =>
    localeSetting === "auto" ? "en" : resolveLocale(localeSetting),
  );
  useEffect(() => {
    setLocale(resolveLocale(localeSetting, browserLanguages()));
  }, [localeSetting]);
  // A locale whose chunk failed to load: go back to the one still shown.
  const shown = useLabels(locale, setLocale);

  // Options that require a new game instance when they change.
  const structuralKey = JSON.stringify([
    assetsBaseUrl,
    duration,
    shells,
    reloadTime,
    musicVolume,
    sfxVolume,
    seed,
    autoStart,
    debug,
    maxPixelRatio,
    adaptiveQuality,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let game: GameInstance | null = null;
    const off: (() => void)[] = [];

    import("../engine/index")
      .then(({ createGame }) => {
        if (disposed) return;
        game = createGame(container, {
          assetsBaseUrl,
          duration,
          shells,
          reloadTime,
          difficulty: difficultyRef.current,
          muted: mutedRef.current,
          musicVolume,
          sfxVolume,
          seed,
          autoStart,
          debug,
          maxPixelRatio,
          adaptiveQuality,
        });
        gameRef.current = game;
        const p = () => propsRef.current;
        off.push(
          game.on("hud", (h) => {
            setHud(h);
            p().onHudChange?.(h);
          }),
          game.on("state", (s) => {
            if (s === "ready") p().onReady?.();
            p().onStateChange?.(s);
          }),
          game.on("start", () => p().onGameStart?.()),
          game.on("shot", (e) => p().onShot?.(e)),
          game.on("hit", (e) => p().onHit?.(e)),
          game.on("reload", () => p().onReload?.()),
          game.on("end", (r) => p().onGameEnd?.(r)),
          game.on("error", (e) => p().onError?.(e)),
        );
        setHud(game.getHud());
      })
      .catch((err: unknown) => {
        if (disposed) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setHud((h) => ({ ...h, state: "error", error: error.message, errorCode: "load" }));
        propsRef.current.onError?.(error);
      });

    return () => {
      disposed = true;
      for (const fn of off) fn();
      game?.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- structuralKey covers the options
  }, [structuralKey]);

  useEffect(() => {
    if (muted === undefined) return;
    mutedRef.current = muted;
    gameRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    if (difficulty === undefined) return;
    difficultyRef.current = difficulty;
    gameRef.current?.setDifficulty(difficulty);
  }, [difficulty]);

  useImperativeHandle(
    ref,
    () => ({
      start: () => gameRef.current?.start(),
      pause: () => gameRef.current?.pause(),
      resume: () => gameRef.current?.resume(),
      reset: () => gameRef.current?.reset(),
      setDifficulty: (d: Difficulty) => {
        difficultyRef.current = d;
        gameRef.current?.setDifficulty(d);
      },
      setLocale: (l: Locale) => {
        if (isLocale(l)) setLocale(l);
        else console.warn(`[killthebird] unsupported locale "${String(l)}"`);
      },
      setFullscreen: (on: boolean) => gameRef.current?.setFullscreen(on),
      toggleFullscreen: () => gameRef.current?.toggleFullscreen(),
      getHud: () => gameRef.current?.getHud() ?? null,
    }),
    [],
  );

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    gameRef.current?.setMuted(next);
  }, []);

  const selectDifficulty = useCallback((d: Difficulty) => {
    if (d === difficultyRef.current) return;
    difficultyRef.current = d;
    gameRef.current?.setDifficulty(d);
    propsRef.current.onDifficultyChange?.(d);
  }, []);

  const selectLocale = useCallback((l: Locale) => {
    setLocale(l);
    propsRef.current.onLocaleChange?.(l);
  }, []);

  const labels: Labels = { ...shown.labels, ...labelOverrides };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 320,
        overflow: "hidden",
        background: "#cfe0e8",
        ...style,
      }}
    >
      {!hideHud && (
        <Hud
          hud={hud}
          labels={labels}
          locale={shown.locale}
          dir={localeDir(shown.locale)}
          selectedLocale={locale}
          points={POINTS}
          showFullscreenButton={fullscreenButton}
          showDifficultySelect={difficultySelect}
          showLanguageSelect={languageSelect}
          onStart={() => {
            // Both calls run inside the click, so the browser allows fullscreen and audio.
            if (startFullscreen) gameRef.current?.setFullscreen(true);
            gameRef.current?.start();
          }}
          onResume={() => gameRef.current?.resume()}
          onReset={() => gameRef.current?.reset()}
          onToggleMute={toggleMute}
          onSelectDifficulty={selectDifficulty}
          onSelectLocale={selectLocale}
          onToggleFullscreen={() => gameRef.current?.toggleFullscreen()}
        />
      )}
    </div>
  );
});
