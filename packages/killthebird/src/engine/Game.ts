import {
  NeutralToneMapping,
  PCFShadowMap,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import { AdaptiveResolution } from "./AdaptiveResolution";
import { GameAudio } from "./Audio";
import { loadModels } from "./Assets";
import { CameraController } from "./CameraController";
import { CAMERA, DIFFICULTY, resolveOptions, type ResolvedOptions } from "./config";
import { BURSTS, Effects } from "./Effects";
import { Bird, HIT_LAYER } from "./entities/Bird";
import { BirdManager } from "./entities/BirdManager";
import { BonusTarget } from "./entities/BonusTarget";
import { Emitter } from "./events";
import { exitFullscreen, fullscreenSupported, isFullscreen, onFullscreenChange, requestFullscreen } from "./fullscreen";
import { Input } from "./Input";
import { Overlay } from "./Overlay";
import { createRng } from "./rng";
import { Session } from "./Session";
import { globalUniforms } from "./shaders/common";
import { IMPACT_COLORS, Impacts } from "./shaders/impacts";
import { ScreenOverlay } from "./shaders/screen";
import type { Difficulty, GameEvents, GameInstance, GameOptions, GameState, HudState } from "./types";
import { World } from "./World";

function findShootable(object: Object3D | null): Bird | BonusTarget | null {
  for (let o = object; o; o = o.parent) {
    const s = o.userData.shootable as Bird | BonusTarget | undefined;
    if (s) return s;
  }
  return null;
}

export class Game implements GameInstance {
  private readonly options: ResolvedOptions;
  private readonly emitter = new Emitter<GameEvents>();
  private readonly session: Session;
  private readonly wrapper: HTMLDivElement;
  private readonly overlay: Overlay;
  private readonly input: Input;
  private readonly audio: GameAudio;
  private readonly cameraController = new CameraController();
  private readonly scene = new Scene();
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly tmp = new Vector3();
  private renderer: WebGLRenderer | null = null;
  /** devicePixelRatio capped by maxPixelRatio; adaptive quality scales it down. */
  private readonly basePixelRatio: number;
  private readonly adaptive: AdaptiveResolution | null;
  private adaptiveLast = 0;
  private effects: Effects | null = null;
  private readonly impacts = new Impacts();
  private readonly screen = new ScreenOverlay();
  private world: World | null = null;
  private birds: BirdManager | null = null;
  private muted: boolean;
  private difficulty: Difficulty;
  private loadProgress = 0;
  private error: string | null = null;
  private raf = 0;
  private lastFrame = 0;
  private visible = true;
  private destroyed = false;
  private lastHudKey = "";
  private fps = { frames: 0, time: 0, value: 0 };
  private readonly cleanup: (() => void)[] = [];

  constructor(
    private readonly container: HTMLElement,
    options: GameOptions = {},
  ) {
    this.options = resolveOptions(options);
    this.muted = this.options.muted;
    this.difficulty = this.options.difficulty;
    this.basePixelRatio = Math.min(globalThis.devicePixelRatio || 1, this.options.maxPixelRatio);
    this.adaptive = this.options.adaptiveQuality ? new AdaptiveResolution(this.basePixelRatio) : null;
    this.session = new Session({
      duration: this.options.duration,
      shells: this.options.shells,
      reloadTime: this.options.reloadTime,
    });

    if (getComputedStyle(container).position === "static") container.style.position = "relative";

    this.wrapper = document.createElement("div");
    Object.assign(this.wrapper.style, {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      touchAction: "none",
      userSelect: "none",
      webkitUserSelect: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    container.insertBefore(this.wrapper, container.firstChild);
    this.overlay = new Overlay(this.wrapper);

    this.input = new Input(container, this.wrapper, {
      shoot: () => this.shoot(),
      reload: () => this.reload(),
      togglePause: () => (this.session.state === "paused" ? this.resume() : this.pause()),
      toggleFullscreen: () => this.toggleFullscreen(),
    });
    this.audio = new GameAudio(this.options.assetsBaseUrl, this.options);
    this.raycaster.layers.set(HIT_LAYER);

    try {
      this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch (err) {
      this.fail(new Error("WebGL is not available in this browser.", { cause: err }));
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(this.basePixelRatio);
    r.toneMapping = NeutralToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFShadowMap;
    Object.assign(r.domElement.style, { display: "block", width: "100%", height: "100%" });
    this.wrapper.insertBefore(r.domElement, this.overlay.root);

    this.observe();
    this.resize();
    this.effects = new Effects(this.scene);
    this.scene.add(this.impacts.group, this.screen.mesh);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    if (this.options.debug) (globalThis as { __killthebird?: Game }).__killthebird = this;
    void this.load();
  }

  get state(): GameState {
    return this.session.state;
  }

  on<K extends keyof GameEvents>(event: K, listener: (payload: GameEvents[K]) => void): () => void {
    return this.emitter.on(event, listener);
  }

  // --- lifecycle -------------------------------------------------------------

  private async load(): Promise<void> {
    try {
      const models = await loadModels(this.options.assetsBaseUrl, (p) => {
        this.loadProgress = p;
        this.emitHud();
      });
      if (this.destroyed) return;
      const rng = createRng(this.options.seed * 7919 + 13);
      this.world = new World(this.scene, models, this.options.seed, this.effects!);
      this.birds = new BirdManager(models.chicken, rng, DIFFICULTY[this.difficulty], this.world.height);
      this.scene.add(this.birds.root);
      this.renderer?.compile(this.scene, this.cameraController.camera);
      this.session.setReady();
      this.emitState();
      if (this.options.autoStart) this.start();
    } catch (err) {
      this.fail(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private fail(err: Error): void {
    console.error("[killthebird]", err);
    this.error = err.message;
    this.session.setError();
    this.emitter.emit("error", err);
    this.emitState();
  }

  private observe(): void {
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.container);
    this.cleanup.push(() => ro.disconnect());

    const io = new IntersectionObserver((entries) => {
      this.visible = entries.some((e) => e.isIntersecting);
      if (!this.visible) this.pause();
      this.adaptive?.reset();
    });
    io.observe(this.container);
    this.cleanup.push(() => io.disconnect());

    const onVisibility = () => {
      if (document.hidden) this.pause();
      this.adaptive?.reset();
    };
    document.addEventListener("visibilitychange", onVisibility);
    this.cleanup.push(() => document.removeEventListener("visibilitychange", onVisibility));

    this.cleanup.push(
      onFullscreenChange(() => {
        if (isFullscreen(this.container)) this.container.focus({ preventScroll: true });
        this.resize();
        this.emitHud();
      }),
    );
  }

  private resize(): void {
    if (!this.renderer) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.cameraController.resize(width, height);
    this.screen.setAspect(width / height);
    this.adaptive?.reset();
  }

  start(): void {
    if (this.destroyed) return;
    this.audio.unlock();
    if (!this.session.start()) return;
    this.world?.resetTargets();
    this.audio.startMusic();
    this.container.focus({ preventScroll: true });
    this.emitter.emit("start", undefined);
    this.emitState();
  }

  pause(): void {
    if (!this.session.pause()) return;
    this.audio.suspend();
    this.emitState();
  }

  resume(): void {
    this.audio.unlock();
    if (!this.session.resume()) return;
    this.audio.resume();
    this.container.focus({ preventScroll: true });
    this.emitState();
  }

  reset(): void {
    if (!this.session.reset()) return;
    this.audio.resume();
    this.audio.stopMusic();
    this.world?.resetTargets();
    this.cameraController.reset();
    this.emitState();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.audio.setMuted(muted);
    this.emitHud();
  }

  setDifficulty(difficulty: Difficulty): void {
    if (this.destroyed || difficulty === this.difficulty || !(difficulty in DIFFICULTY)) return;
    this.difficulty = difficulty;
    this.birds?.setDifficulty(DIFFICULTY[difficulty]);
    this.emitHud();
  }

  setFullscreen(on: boolean): void {
    if (this.destroyed || on === isFullscreen(this.container)) return;
    if (on) requestFullscreen(this.container);
    else exitFullscreen();
  }

  toggleFullscreen(): void {
    this.setFullscreen(!isFullscreen(this.container));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    for (const fn of this.cleanup) fn();
    if (isFullscreen(this.container)) exitFullscreen();
    this.input.dispose();
    this.audio.dispose();
    this.birds?.dispose();
    this.world?.dispose();
    this.effects?.dispose();
    this.impacts.dispose();
    this.screen.dispose();
    this.overlay.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.wrapper.remove();
    this.emitter.clear();
  }

  // --- gameplay ----------------------------------------------------------------

  private shoot(): void {
    const result = this.session.fire();
    if (result === "inactive" || result === "cooldown") return;
    if (result === "empty" || result === "reloading") {
      this.audio.play("empty");
      return;
    }

    this.audio.play("shot", 1, 0.95 + Math.random() * 0.1);
    this.cameraController.kick();
    this.overlay.kick();
    this.screen.flash();

    const camera = this.cameraController.camera;
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.ndc.set((this.input.x / width) * 2 - 1, -(this.input.y / height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, camera);
    const hits = this.raycaster.intersectObject(this.scene, true);
    const first = hits[0];
    const target = first ? findShootable(first.object) : null;

    let hit = false;
    if (target instanceof Bird && target.alive) {
      hit = true;
      const points = target.points;
      target.hit();
      this.effects?.burst(target.root.position, BURSTS.feathers, target.scale);
      this.impacts.spawn(target.root.position, IMPACT_COLORS.bird, target.scale * 2.2);
      this.audio.play("hit", 0.9, 0.9 + Math.random() * 0.25);
      this.scoreHit(points, target.layer, "bird", target.root.position);
    } else if (target instanceof BonusTarget && target.hittable && first) {
      hit = true;
      target.hit(first.point);
      this.impacts.spawn(first.point, IMPACT_COLORS.bonus, first.distance * 0.09);
      this.audio.play("bonus");
      this.scoreHit(target.points, "bonus", target.kind, first.point);
    } else if (first?.object.userData.water && this.world) {
      this.effects?.burst(first.point, BURSTS.splash, Math.max(0.8, first.distance / 14));
      this.world.pond.ripple(first.point.x, first.point.z);
      this.impacts.spawn(first.point, IMPACT_COLORS.water, first.distance * 0.06, 0.35);
    } else if (first) {
      const distance = first.distance;
      this.effects?.burst(first.point, BURSTS.dust, Math.max(0.6, distance / 12));
      this.impacts.spawn(first.point, IMPACT_COLORS.ground, distance * 0.05, 0.3);
    }

    this.emitter.emit("shot", { hit, shellsLeft: this.session.weapon.shells });
    this.emitHud();
  }

  private scoreHit(points: number, layer: "near" | "mid" | "far" | "bonus", target: GameEvents["hit"]["target"], at: Vector3): void {
    this.session.registerHit(points, layer);
    const screen = this.toScreen(at);
    this.overlay.popup(screen.x, screen.y, `+${points}`, layer === "bonus" ? "#7cf3ff" : "#ffe14d", points >= 25);
    this.emitter.emit("hit", {
      points,
      layer,
      target,
      totalScore: this.session.score,
      screenX: screen.x,
      screenY: screen.y,
    });
  }

  private reload(): void {
    if (this.session.reload()) {
      this.audio.play("reload");
      this.emitter.emit("reload", undefined);
      this.emitHud();
    }
  }

  private toScreen(world: Vector3): { x: number; y: number } {
    const p = this.tmp.copy(world).project(this.cameraController.camera);
    return {
      x: ((p.x + 1) / 2) * this.container.clientWidth,
      y: ((1 - p.y) / 2) * this.container.clientHeight,
    };
  }

  private endRound(): void {
    this.audio.stopMusic(1.2);
    this.audio.play("end");
    const result = this.session.result();
    this.emitter.emit("end", result);
    this.emitState();
  }

  // --- frame loop ----------------------------------------------------------------

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (!this.visible || !this.renderer) return;
    // One clock for all shaders (several games on a page must not speed it up).
    globalUniforms.uTime.value = (now / 1000) % 3600;
    this.screen.update(dt);

    const state = this.session.state;
    if (state !== "paused") {
      const { ended } = this.session.update(dt);
      if (ended) this.endRound();
      const playing = this.session.state === "playing";
      this.cameraController.update(dt, this.input, playing);
      const camX = this.cameraController.x;
      this.world?.update(dt, camX);
      this.birds?.update(
        dt,
        {
          cameraX: camX,
          cameraY: CAMERA.height,
          fov: this.cameraController.fov,
          aspect: this.cameraController.aspect,
          speedMultiplier: 1,
        },
        state !== "loading" && state !== "error",
      );
      this.effects?.update(dt);
    }

    const playing = this.session.state === "playing";
    this.overlay.setCrosshair(this.input.x, this.input.y, playing && this.input.inside);
    this.wrapper.style.cursor = playing ? "none" : "default";

    this.renderer.render(this.scene, this.cameraController.camera);
    if (this.adaptive) this.adapt(this.adaptive, this.renderer, now);
    if (this.options.debug) this.updateDebug(dt);
    this.emitHud();
  };

  /** Feeds the frame time to the adaptive resolution and applies a new pixel ratio. */
  private adapt(adaptive: AdaptiveResolution, renderer: WebGLRenderer, now: number): void {
    const state = this.session.state;
    // Loading and pause are not representative (and leaving them restarts the warm-up).
    const active = state === "ready" || state === "playing" || state === "ended";
    // setPixelRatio only resizes the drawing buffer; the canvas keeps its CSS size,
    // so pointer and raycast coordinates (CSS pixels) are unaffected.
    if (adaptive.update(now - this.adaptiveLast, active)) {
      renderer.setPixelRatio(this.basePixelRatio * adaptive.scale);
    }
    this.adaptiveLast = now;
  }

  private updateDebug(dt: number): void {
    this.fps.frames++;
    this.fps.time += dt;
    if (this.fps.time < 0.5) return;
    this.fps.value = Math.round(this.fps.frames / this.fps.time);
    this.fps.frames = 0;
    this.fps.time = 0;
    const info = this.renderer!.info.render;
    this.overlay.debug(
      `${this.fps.value} fps\n${info.calls} draw calls\n${(info.triangles / 1000).toFixed(1)}k tris\n${this.renderer!.getPixelRatio().toFixed(2)} px ratio\ncam x ${this.cameraController.x.toFixed(1)}`,
    );
  }

  // --- HUD -----------------------------------------------------------------------

  getHud(): HudState {
    const s = this.session;
    return {
      state: s.state,
      score: s.score,
      shells: s.weapon.shells,
      maxShells: s.weapon.capacity,
      reloading: s.weapon.reloading,
      timeLeft: s.timeLeft,
      duration: this.options.duration,
      loadProgress: this.loadProgress,
      muted: this.muted,
      difficulty: this.difficulty,
      fullscreen: isFullscreen(this.container),
      fullscreenSupported: fullscreenSupported(this.container),
      lastResult: s.state === "ended" ? s.result() : null,
      error: this.error,
    };
  }

  private emitHud(): void {
    const s = this.session;
    const key = [
      s.state,
      s.score,
      s.weapon.shells,
      s.weapon.reloading,
      Math.ceil(s.timeLeft),
      Math.round(this.loadProgress * 100),
      this.muted,
      this.difficulty,
      isFullscreen(this.container),
      this.error,
    ].join("|");
    if (key === this.lastHudKey) return;
    this.lastHudKey = key;
    this.emitter.emit("hud", this.getHud());
  }

  private emitState(): void {
    this.emitter.emit("state", this.session.state);
    this.emitHud();
  }
}

/** Creates a game inside `container` (which should have a size). */
export function createGame(container: HTMLElement, options?: GameOptions): GameInstance {
  return new Game(container, options);
}
