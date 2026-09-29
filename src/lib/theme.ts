// Light / dark theme and the side menu's state, both kept in cookies so the
// server can apply them while rendering (THEME-2, NAV-1): nothing flashes or
// jumps once the page is on screen. Pure: the cookie is read elsewhere.

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";

/** THEME-1: anything but a known choice follows the device. */
export function resolveTheme(value: string | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}

/**
 * THEME-2: the class on <html>. "system" gets none, and the CSS follows
 * `prefers-color-scheme`, which the browser resolves before the first paint.
 */
export function htmlThemeClass(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}

export type SidebarState = "expanded" | "collapsed";
export const SIDEBAR_COOKIE = "sidebar";

/** NAV-1 */
export function resolveSidebar(value: string | undefined): SidebarState {
  return value === "collapsed" ? "collapsed" : "expanded";
}
