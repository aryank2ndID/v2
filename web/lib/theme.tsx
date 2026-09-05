/* SANDHI — theme control.
 *
 * Light is the default (matching the app's print/clinic aesthetic). A toggle
 * switches to dark by setting [data-theme="dark"] on <html>; the choice is
 * remembered. SSR-safe: the attribute is applied only after mount, so the
 * server and first paint stay on the light default (no flash of wrong theme).
 */
"use client";
import * as React from "react";

export type Theme = "light" | "dark";
const THEME_KEY = "sandhi.theme.v1";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const Ctx = React.createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");

  React.useEffect(() => {
    let t: Theme = "light";
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") t = saved;
    } catch { /* storage unavailable */ }
    setThemeState(t);
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const setTheme = React.useCallback((t: Theme) => setThemeState(t), []);
  const toggle = React.useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);

  const value = React.useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useTheme outside ThemeProvider");
  return v;
}
