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
  GameInstance,
  GameOptions,
  GameResult,
  GameState,
  HitEvent,
  HudState,
  Locale,
  ShotEvent,
} from "../engine/types";
import { Hud } from "./Hud";
import { LABELS, type Labels } from "./labels";

export interface KillTheBirdProps extends GameOptions {
  /** HUD language. Default: "de". */
  locale?: Locale;
  /** Override single HUD texts. */
  labels?: Partial<Labels>;
  /** Hide the built-in HUD and menus (use the events / ref to build your own). */
  hideHud?: boolean;
  /** Show the fullscreen button in the HUD. Default: true. */
  fullscreenButton?: boolean;
  /** The start / play-again button also switches to browser fullscreen. Default: false. */
  startFullscreen?: boolean;
  className?: string;
  style?: CSSProperties;
  onReady?(): void;
  onGameStart?(): void;
  onShot?(event: ShotEvent): void;
  onHit?(event: HitEvent): void;
  onReload?(): void;
  onGameEnd?(result: GameResult): void;
  onStateChange?(state: GameState): void;
  onHudChange?(hud: HudState): void;
  onError?(error: Error): void;
}

export interface KillTheBirdHandle {
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
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
  fullscreen: false,
  fullscreenSupported: false,
  lastResult: null,
  error: null,
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
    locale = "de",
    labels: labelOverrides,
    hideHud = false,
    fullscreenButton = true,
    startFullscreen = false,
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
  }));
  const mutedRef = useRef(muted ?? false);

  // Options that require a new game instance when they change.
  const structuralKey = JSON.stringify([
    assetsBaseUrl,
    duration,
    shells,
    reloadTime,
    difficulty,
    musicVolume,
    sfxVolume,
    seed,
    autoStart,
    debug,
    maxPixelRatio,
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
          difficulty,
          muted: mutedRef.current,
          musicVolume,
          sfxVolume,
          seed,
          autoStart,
          debug,
          maxPixelRatio,
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
        setHud((h) => ({ ...h, state: "error", error: error.message }));
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

  useImperativeHandle(
    ref,
    () => ({
      start: () => gameRef.current?.start(),
      pause: () => gameRef.current?.pause(),
      resume: () => gameRef.current?.resume(),
      reset: () => gameRef.current?.reset(),
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

  const labels: Labels = { ...LABELS[locale], ...labelOverrides };

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
          points={POINTS}
          showFullscreenButton={fullscreenButton}
          onStart={() => {
            // Both calls run inside the click, so the browser allows fullscreen and audio.
            if (startFullscreen) gameRef.current?.setFullscreen(true);
            gameRef.current?.start();
          }}
          onResume={() => gameRef.current?.resume()}
          onReset={() => gameRef.current?.reset()}
          onToggleMute={toggleMute}
          onToggleFullscreen={() => gameRef.current?.toggleFullscreen()}
        />
      )}
    </div>
  );
});
