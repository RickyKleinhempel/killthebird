const CROSSHAIR_SIZE = 56;

const CROSSHAIR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="${CROSSHAIR_SIZE}" height="${CROSSHAIR_SIZE}" viewBox="0 0 56 56">
  <g fill="none" stroke-linecap="round">
    <g stroke="rgba(0,0,0,.55)" stroke-width="4.5">
      <circle cx="28" cy="28" r="17"/>
      <path d="M28 4v12M28 40v12M4 28h12M40 28h12"/>
    </g>
    <g stroke="#fff" stroke-width="2">
      <circle cx="28" cy="28" r="17"/>
      <path d="M28 4v12M28 40v12M4 28h12M40 28h12"/>
    </g>
  </g>
  <circle cx="28" cy="28" r="2.4" fill="#e3342f" stroke="#000" stroke-opacity=".5"/>
</svg>`;

/**
 * DOM layer above the canvas: crosshair, score popups and the debug readout.
 * Lives inside the engine so it also works without the React wrapper.
 */
export class Overlay {
  readonly root: HTMLDivElement;
  private readonly crosshair: HTMLDivElement;
  private readonly crosshairInner: HTMLDivElement;
  private debugEl: HTMLDivElement | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      overflow: "hidden",
      userSelect: "none",
    } satisfies Partial<CSSStyleDeclaration>);

    this.crosshair = document.createElement("div");
    Object.assign(this.crosshair.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${CROSSHAIR_SIZE}px`,
      height: `${CROSSHAIR_SIZE}px`,
      marginLeft: `${-CROSSHAIR_SIZE / 2}px`,
      marginTop: `${-CROSSHAIR_SIZE / 2}px`,
      display: "none",
      willChange: "transform",
      zIndex: "3",
    } satisfies Partial<CSSStyleDeclaration>);
    this.crosshairInner = document.createElement("div");
    this.crosshairInner.innerHTML = CROSSHAIR_SVG;
    this.crosshair.appendChild(this.crosshairInner);
    this.root.appendChild(this.crosshair);
    parent.appendChild(this.root);
  }

  setCrosshair(x: number, y: number, visible: boolean): void {
    this.crosshair.style.display = visible ? "block" : "none";
    if (visible) this.crosshair.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  kick(): void {
    this.crosshairInner.animate?.(
      [{ transform: "scale(1.35) rotate(6deg)" }, { transform: "scale(1) rotate(0)" }],
      { duration: 160, easing: "ease-out" },
    );
  }

  popup(x: number, y: number, text: string, color = "#ffe14d", big = false): void {
    const el = document.createElement("div");
    el.textContent = text;
    Object.assign(el.style, {
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      transform: "translate(-50%, -50%)",
      font: `900 ${big ? 34 : 26}px/1 system-ui, -apple-system, "Segoe UI", sans-serif`,
      color,
      textShadow: "0 2px 0 #000, 0 0 6px rgba(0,0,0,.6)",
      whiteSpace: "nowrap",
      zIndex: "2",
    } satisfies Partial<CSSStyleDeclaration>);
    this.root.appendChild(el);
    const animation = el.animate?.(
      [
        { transform: "translate(-50%, -50%) scale(.6)", opacity: 0 },
        { transform: "translate(-50%, -90%) scale(1.15)", opacity: 1, offset: 0.18 },
        { transform: "translate(-50%, -220%) scale(1)", opacity: 0 },
      ],
      { duration: 1000, easing: "ease-out" },
    );
    if (animation) animation.onfinish = () => el.remove();
    else setTimeout(() => el.remove(), 1000);
  }

  debug(text: string): void {
    if (!this.debugEl) {
      this.debugEl = document.createElement("div");
      Object.assign(this.debugEl.style, {
        position: "absolute",
        left: "50%",
        top: "8px",
        transform: "translateX(-50%)",
        padding: "4px 6px",
        font: "11px/1.3 ui-monospace, monospace",
        color: "#0f0",
        background: "rgba(0,0,0,.6)",
        whiteSpace: "pre",
        zIndex: "4",
      } satisfies Partial<CSSStyleDeclaration>);
      this.root.appendChild(this.debugEl);
    }
    this.debugEl.textContent = text;
  }

  dispose(): void {
    this.root.remove();
  }
}
