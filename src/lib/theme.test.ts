import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE, htmlThemeClass, PALETTES, resolvePalette, resolveSidebar, resolveTheme } from "./theme";

describe("the theme (THEME)", () => {
  it("follows the device until Claro or Oscuro is picked (THEME-1)", () => {
    expect(resolveTheme(undefined)).toBe("system");
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("system")).toBe("system");
  });

  it("treats anything else stored as Sistema (THEME-1)", () => {
    expect(resolveTheme("purple")).toBe("system");
  });

  it("puts the picked theme on the page as it is served, and nothing for Sistema (THEME-2)", () => {
    // Sistema leaves it to the CSS media query, which the browser applies before painting.
    expect(htmlThemeClass("dark")).toBe("dark");
    expect(htmlThemeClass("light")).toBe("light");
    expect(htmlThemeClass("system")).toBeUndefined();
  });
});

describe("the colour theme (THEME-3)", () => {
  it("offers Teal nórdico, Terracota, Malva and Pizarra, Teal nórdico first", () => {
    expect(PALETTES).toEqual(["teal", "terracota", "malva", "pizarra"]);
    expect(DEFAULT_PALETTE).toBe("teal");
  });

  it("is Teal nórdico until another one is picked", () => {
    expect(resolvePalette(undefined)).toBe("teal");
    for (const palette of PALETTES) expect(resolvePalette(palette)).toBe(palette);
  });

  it("treats anything else stored as Teal nórdico", () => {
    // An old or tampered cookie must still give a complete set of colours.
    expect(resolvePalette("blue")).toBe("teal");
    expect(resolvePalette("")).toBe("teal");
  });
});

describe("the side menu (NAV-1)", () => {
  it("is expanded unless it was collapsed", () => {
    expect(resolveSidebar(undefined)).toBe("expanded");
    expect(resolveSidebar("collapsed")).toBe("collapsed");
    expect(resolveSidebar("nonsense")).toBe("expanded");
  });
});
