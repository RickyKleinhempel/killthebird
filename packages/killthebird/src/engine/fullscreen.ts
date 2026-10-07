// Fullscreen API with the WebKit prefixes Safari still needs.

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
};

export function fullscreenSupported(element: HTMLElement): boolean {
  const doc = document as WebkitDocument;
  const enabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
  const el = element as WebkitElement;
  return enabled && typeof (el.requestFullscreen ?? el.webkitRequestFullscreen) === "function";
}

export function isFullscreen(element: HTMLElement): boolean {
  const doc = document as WebkitDocument;
  return (doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null) === element;
}

/** Must be called from a user gesture (click, key press). */
export function requestFullscreen(element: HTMLElement): void {
  const el = element as WebkitElement;
  const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
  try {
    const result = request?.call(el, { navigationUI: "hide" });
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch {
    // Denied (no user gesture, iframe without allow="fullscreen", ...): stay windowed.
  }
}

export function exitFullscreen(): void {
  const doc = document as WebkitDocument;
  const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  try {
    const result = exit?.call(doc);
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch {
    // Not in fullscreen.
  }
}

export function onFullscreenChange(listener: () => void): () => void {
  document.addEventListener("fullscreenchange", listener);
  document.addEventListener("webkitfullscreenchange", listener);
  return () => {
    document.removeEventListener("fullscreenchange", listener);
    document.removeEventListener("webkitfullscreenchange", listener);
  };
}
