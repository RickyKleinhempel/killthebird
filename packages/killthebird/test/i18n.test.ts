import { describe, expect, it } from "vitest";
import { LOCALES, isLocale, loadLabels, resolveLocale } from "../src/react/i18n/registry";
import type { Labels } from "../src/react/labels";

/** Key paths and array lengths, e.g. ["howTo[4]", "points.near", …]. */
function shape(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return [`${path}[${value.length}]`];
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .flatMap((k) => shape((value as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
  }
  return [path];
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("locales", () => {
  it("lists every locale once with a name", () => {
    const codes = LOCALES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBeGreaterThanOrEqual(31);
    for (const l of LOCALES) expect(l.name.trim()).not.toBe("");
    expect(LOCALES.filter((l) => l.dir === "rtl").map((l) => l.code).sort()).toEqual(["ar", "fa", "he"]);
  });

  it.each(LOCALES.map((l) => l.code))("%s has every text", async (code) => {
    const en = await loadLabels("en");
    const labels: Labels = await loadLabels(code);
    expect(shape(labels)).toEqual(shape(en));
    for (const s of strings(labels)) expect(s.trim()).not.toBe("");
  });
});

describe("resolveLocale", () => {
  it("uses an explicit locale", () => {
    expect(resolveLocale("ja", ["de-DE"])).toBe("ja");
  });

  it("auto picks the first supported browser language", () => {
    expect(resolveLocale("auto", ["xx", "de-AT", "en"])).toBe("de");
    expect(resolveLocale(undefined, ["fr-CA"])).toBe("fr");
  });

  it("maps region and script variants", () => {
    expect(resolveLocale("auto", ["pt-PT"])).toBe("pt-BR");
    expect(resolveLocale("auto", ["pt_br"])).toBe("pt-BR");
    expect(resolveLocale("auto", ["zh"])).toBe("zh-CN");
    expect(resolveLocale("auto", ["zh-SG"])).toBe("zh-CN");
    expect(resolveLocale("auto", ["zh-HK"])).toBe("zh-TW");
    expect(resolveLocale("auto", ["zh-Hant-TW"])).toBe("zh-TW");
    expect(resolveLocale("auto", ["zh-Hans-HK"])).toBe("zh-CN");
    expect(resolveLocale("auto", ["no"])).toBe("nb");
    expect(resolveLocale("auto", ["nn-NO"])).toBe("nb");
    expect(resolveLocale("auto", ["iw"])).toBe("he");
  });

  it("falls back to English", () => {
    expect(resolveLocale("auto", [])).toBe("en");
    expect(resolveLocale("auto", ["sw", "xx-YY"])).toBe("en");
    expect(resolveLocale("klingon")).toBe("en");
  });

  it("isLocale", () => {
    expect(isLocale("zh-TW")).toBe(true);
    expect(isLocale("zh")).toBe(false);
    expect(isLocale("toString")).toBe(false);
  });
});
