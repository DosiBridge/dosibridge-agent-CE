/**
 * Theme provider component to ensure theme is properly initialized
 */
"use client";

import { useStore } from "@/lib/store";
import { useEffect } from "react";

export default function ThemeProvider() {
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);

  // Sync theme changes and ensure it's applied
  useEffect(() => {
    const root = document.documentElement;
    let actualTheme: "light" | "dark" = "dark";

    if (theme === "system") {
      actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else if (theme === "light" || theme === "dark") {
      actualTheme = theme;
    }

    // Apply theme to HTML element
    if (actualTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Listen for system theme changes if using system preference
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        const root = document.documentElement;
        if (e.matches) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      };
      mediaQuery.addEventListener("change", handleSystemThemeChange);
      return () =>
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
    }
  }, [theme]);

  return null; // This component doesn't render anything
}
