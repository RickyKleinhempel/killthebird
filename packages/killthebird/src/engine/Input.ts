export interface InputHandlers {
  shoot(): void;
  reload(): void;
  togglePause(): void;
  toggleFullscreen(): void;
}

/**
 * Pointer and keyboard input. Pointer position is tracked on the whole game
 * container (so HUD elements don't block edge scrolling); shots only come
 * from presses on the canvas surface.
 */
export class Input {
  /** Pointer position in CSS pixels relative to the container. */
  x = 0;
  y = 0;
  /** Normalised pointer position, 0..1. */
  u = 0.5;
  v = 0.5;
  inside = false;
  /** -1, 0 or 1 from arrow keys / A, D. */
  keyDirection = 0;

  private keys = new Set<string>();
  private readonly cleanup: (() => void)[] = [];

  constructor(
    private readonly container: HTMLElement,
    surface: HTMLElement,
    private readonly handlers: InputHandlers,
  ) {
    if (!container.hasAttribute("tabindex")) container.tabIndex = 0;
    container.style.outline = "none";

    this.listen(container, "pointermove", (e) => this.track(e as PointerEvent));
    this.listen(container, "pointerenter", (e) => this.track(e as PointerEvent));
    this.listen(container, "pointerleave", () => {
      this.inside = false;
    });
    this.listen(container, "contextmenu", (e) => e.preventDefault());
    this.listen(surface, "pointerdown", (e) => this.press(e as PointerEvent));
    this.listen(container, "keydown", (e) => this.keyDown(e as KeyboardEvent));
    this.listen(container, "keyup", (e) => this.keyUp(e as KeyboardEvent));
    this.listen(container, "blur", () => {
      this.keys.clear();
      this.updateKeyDirection();
    });
  }

  private listen(target: EventTarget, type: string, fn: (e: Event) => void) {
    target.addEventListener(type, fn);
    this.cleanup.push(() => target.removeEventListener(type, fn));
  }

  private track(e: PointerEvent) {
    const rect = this.container.getBoundingClientRect();
    this.x = e.clientX - rect.left;
    this.y = e.clientY - rect.top;
    this.u = rect.width > 0 ? this.x / rect.width : 0.5;
    this.v = rect.height > 0 ? this.y / rect.height : 0.5;
    // Touch has no hover: don't let a tap near the border start scrolling.
    this.inside = e.pointerType !== "touch";
  }

  private press(e: PointerEvent) {
    this.track(e);
    if (e.pointerType === "touch") this.inside = false;
    this.container.focus({ preventScroll: true });
    if (e.button === 0) {
      e.preventDefault();
      this.handlers.shoot();
    } else if (e.button === 2) {
      e.preventDefault();
      this.handlers.reload();
    }
  }

  private keyDown(e: KeyboardEvent) {
    // Keys typed into the HUD's form controls (e.g. the language selector) are theirs.
    if (isFormControl(e.target)) return;
    switch (e.code) {
      case "Space":
      case "KeyR":
        e.preventDefault();
        if (!e.repeat) this.handlers.reload();
        return;
      case "Escape":
      case "KeyP":
        if (!e.repeat) this.handlers.togglePause();
        return;
      case "KeyF":
        if (!e.repeat) this.handlers.toggleFullscreen();
        return;
      case "ArrowLeft":
      case "ArrowRight":
      case "KeyA":
      case "KeyD":
        e.preventDefault();
        this.keys.add(e.code);
        this.updateKeyDirection();
        return;
    }
  }

  private keyUp(e: KeyboardEvent) {
    this.keys.delete(e.code);
    this.updateKeyDirection();
  }

  private updateKeyDirection() {
    const left = this.keys.has("ArrowLeft") || this.keys.has("KeyA");
    const right = this.keys.has("ArrowRight") || this.keys.has("KeyD");
    this.keyDirection = (right ? 1 : 0) - (left ? 1 : 0);
  }

  dispose(): void {
    for (const fn of this.cleanup) fn();
    this.cleanup.length = 0;
  }
}

function isFormControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "SELECT" || target.tagName === "INPUT" || target.tagName === "TEXTAREA";
}
