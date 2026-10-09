import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../engine/types";
import type { Labels } from "../labels";
import { bundledLabels, loadLabels } from "./registry";

export interface ShownLabels {
  /** The locale `labels` belong to; lags behind the requested one while its chunk loads. */
  locale: Locale;
  labels: Labels;
}

/**
 * The texts for `locale`. Bundled locales are available right away; others
 * keep showing the previous texts (English at first) until their chunk is in.
 * If a chunk fails to load, `onLoadError` gets the locale that is still shown,
 * so the caller can switch back to it (and a later pick retries the load).
 */
export function useLabels(locale: Locale, onLoadError?: (shown: Locale) => void): ShownLabels {
  const [loaded, setLoaded] = useState<ShownLabels>(() => ({ locale: "en", labels: bundledLabels("en")! }));
  const bundled = bundledLabels(locale);
  const shown = bundled ? { locale, labels: bundled } : loaded;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;

  useEffect(() => {
    const bundled = bundledLabels(locale);
    if (bundled) {
      setLoaded({ locale, labels: bundled });
      return;
    }
    let cancelled = false;
    loadLabels(locale).then(
      (labels) => {
        if (!cancelled) setLoaded({ locale, labels });
      },
      (err: unknown) => {
        console.error(`[killthebird] could not load locale "${locale}"`, err);
        if (!cancelled) onLoadErrorRef.current?.(shownRef.current.locale);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return shown;
}
