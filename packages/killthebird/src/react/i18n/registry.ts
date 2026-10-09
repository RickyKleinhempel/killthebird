import type { Locale, LocaleSetting } from "../../engine/types";
import { LABELS, type Labels } from "../labels";

export interface LocaleInfo {
  code: Locale;
  /** The language's own name, e.g. "Français". */
  name: string;
  dir: "ltr" | "rtl";
}

type Entry = { name: string; dir?: "rtl"; load(): Promise<{ default: Labels }> };

// German and English ship with the main bundle; every other locale is its own
// chunk and only downloaded when picked.
const bundled = (labels: Labels) => () => Promise.resolve({ default: labels });

const REGISTRY: Record<Locale, Entry> = {
  de: { name: "Deutsch", load: bundled(LABELS.de) },
  en: { name: "English", load: bundled(LABELS.en) },
  fr: { name: "Français", load: () => import("./locales/fr") },
  es: { name: "Español", load: () => import("./locales/es") },
  it: { name: "Italiano", load: () => import("./locales/it") },
  "pt-BR": { name: "Português (Brasil)", load: () => import("./locales/pt-BR") },
  ro: { name: "Română", load: () => import("./locales/ro") },
  nl: { name: "Nederlands", load: () => import("./locales/nl") },
  sv: { name: "Svenska", load: () => import("./locales/sv") },
  da: { name: "Dansk", load: () => import("./locales/da") },
  nb: { name: "Norsk bokmål", load: () => import("./locales/nb") },
  fi: { name: "Suomi", load: () => import("./locales/fi") },
  pl: { name: "Polski", load: () => import("./locales/pl") },
  cs: { name: "Čeština", load: () => import("./locales/cs") },
  hu: { name: "Magyar", load: () => import("./locales/hu") },
  ru: { name: "Русский", load: () => import("./locales/ru") },
  uk: { name: "Українська", load: () => import("./locales/uk") },
  el: { name: "Ελληνικά", load: () => import("./locales/el") },
  tr: { name: "Türkçe", load: () => import("./locales/tr") },
  ar: { name: "العربية", dir: "rtl", load: () => import("./locales/ar") },
  he: { name: "עברית", dir: "rtl", load: () => import("./locales/he") },
  fa: { name: "فارسی", dir: "rtl", load: () => import("./locales/fa") },
  hi: { name: "हिन्दी", load: () => import("./locales/hi") },
  bn: { name: "বাংলা", load: () => import("./locales/bn") },
  th: { name: "ไทย", load: () => import("./locales/th") },
  id: { name: "Bahasa Indonesia", load: () => import("./locales/id") },
  vi: { name: "Tiếng Việt", load: () => import("./locales/vi") },
  ja: { name: "日本語", load: () => import("./locales/ja") },
  ko: { name: "한국어", load: () => import("./locales/ko") },
  "zh-CN": { name: "简体中文", load: () => import("./locales/zh-CN") },
  "zh-TW": { name: "繁體中文", load: () => import("./locales/zh-TW") },
};

/** All supported locales, in the order the language selector lists them. */
export const LOCALES: readonly LocaleInfo[] = (Object.keys(REGISTRY) as Locale[]).map((code) => ({
  code,
  name: REGISTRY[code].name,
  dir: REGISTRY[code].dir ?? "ltr",
}));

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(REGISTRY, value);
}

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return REGISTRY[locale].dir ?? "ltr";
}

/** The labels of `locale`; synchronous for the bundled ones ("de", "en"), else `undefined`. */
export function bundledLabels(locale: Locale): Labels | undefined {
  return locale === "de" || locale === "en" ? LABELS[locale] : undefined;
}

/** Loads the HUD texts of a locale (downloads its chunk on first use). */
export async function loadLabels(locale: Locale): Promise<Labels> {
  return (await REGISTRY[locale].load()).default;
}

const BY_LOWER = new Map((Object.keys(REGISTRY) as Locale[]).map((code) => [code.toLowerCase(), code]));
// Language subtags whose best match is not "same subtag".
const LANGUAGE_ALIASES: Record<string, Locale> = { pt: "pt-BR", no: "nb", nn: "nb", iw: "he", in: "id" };

function matchTag(tag: string): Locale | undefined {
  const lower = tag.trim().toLowerCase().replace(/_/g, "-");
  const exact = BY_LOWER.get(lower);
  if (exact) return exact;
  const [language = "", ...rest] = lower.split("-");
  if (language === "zh") {
    const traditional = rest.some((s) => s === "hant" || s === "tw" || s === "hk" || s === "mo");
    return traditional ? "zh-TW" : "zh-CN";
  }
  return LANGUAGE_ALIASES[language] ?? BY_LOWER.get(language);
}

/**
 * Picks the HUD locale. "auto" (or nothing) uses the first of `languages`
 * (e.g. `navigator.languages`) we support; anything unsupported falls back to
 * English. Region variants map to their language ("fr-CA" -> "fr",
 * "pt-PT" -> "pt-BR", "zh-HK" -> "zh-TW").
 */
export function resolveLocale(setting: LocaleSetting | string | undefined, languages: readonly string[] = []): Locale {
  const candidates = setting === undefined || setting === "auto" ? languages : [setting];
  for (const tag of candidates) {
    const match = matchTag(tag);
    if (match) return match;
  }
  return "en";
}

/** The browser's preferred languages ([] on the server). */
export function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : [];
}
