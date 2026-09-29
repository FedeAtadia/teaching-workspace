import { describe, expect, it } from "vitest";
import { htmlThemeClass, resolveSidebar, resolveTheme } from "./theme";

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

describe("the side menu (NAV-1)", () => {
  it("is expanded unless it was collapsed", () => {
    expect(resolveSidebar(undefined)).toBe("expanded");
    expect(resolveSidebar("collapsed")).toBe("collapsed");
    expect(resolveSidebar("nonsense")).toBe("expanded");
  });
});
