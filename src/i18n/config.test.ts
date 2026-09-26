import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es-AR.json";
import { resolveLocale } from "./config";

describe("language (LOCALE)", () => {
  it("starts in Spanish (Argentina) when nothing has been chosen (LOCALE-1)", () => {
    expect(resolveLocale(undefined)).toBe("es-AR");
  });

  it("keeps a supported choice and ignores anything else (LOCALE-2)", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("fr")).toBe("es-AR");
  });

  it("has every English text translated to Spanish and back (LOCALE-3)", () => {
    // A key present in one file only shows up as a raw key in the UI.
    const keys = (o: object, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
      );
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });
});
