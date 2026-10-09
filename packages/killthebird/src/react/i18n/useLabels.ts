import { useEffect, useState } from "react";
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
 */
export function useLabels(locale: Locale): ShownLabels {
  const [loaded, setLoaded] = useState<ShownLabels>(() => ({ locale: "en", labels: bundledLabels("en")! }));

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
      (err: unknown) => console.error(`[killthebird] could not load locale "${locale}"`, err),
    );
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const bundled = bundledLabels(locale);
  return bundled ? { locale, labels: bundled } : loaded;
}
