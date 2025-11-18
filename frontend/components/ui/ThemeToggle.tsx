/**
 * Theme toggle component for switching between light, dark, and system mode
 */
"use client";

import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const [isOpen, setIsOpen] = useState(false);

  // Apply theme when it changes
  useEffect(() => {
    const root = document.documentElement;
    let actualTheme: "light" | "dark" = "dark";

    if (theme === "system") {
      actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else {
      actualTheme = theme;
    }

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

  const getCurrentIcon = () => {
    if (theme === "system") {
      return <Monitor className="w-4 h-4" />;
    } else if (theme === "light") {
      return <Sun className="w-4 h-4" />;
    } else {
      return <Moon className="w-4 h-4" />;
    }
  };

  const getCurrentLabel = () => {
    if (theme === "system") return "System";
    if (theme === "light") return "Light";
    return "Dark";
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-1.5 rounded-lg transition-all duration-200",
          "bg-[var(--surface-elevated)]/80 hover:bg-[var(--surface-hover)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:ring-offset-2 focus:ring-offset-transparent",
          "touch-manipulation active:scale-95 backdrop-blur-sm flex items-center justify-center"
        )}
        aria-label={`Current theme: ${getCurrentLabel()}`}
        title={`Current theme: ${getCurrentLabel()}`}
      >
        <div className="relative w-4 h-4 text-[var(--text-primary)]">
          {getCurrentIcon()}
        </div>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-32 bg-[var(--modal-bg)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">
            <button
              onClick={() => {
                setTheme("light");
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors",
                "hover:bg-[var(--surface-hover)]",
                theme === "light" &&
                  "bg-[var(--surface-hover)] text-[var(--green)]"
              )}
            >
              <Sun className="w-3.5 h-3.5" />
              <span className="text-[var(--text-primary)] text-xs">Light</span>
            </button>
            <button
              onClick={() => {
                setTheme("dark");
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors",
                "hover:bg-[var(--surface-hover)]",
                theme === "dark" &&
                  "bg-[var(--surface-hover)] text-[var(--green)]"
              )}
            >
              <Moon className="w-3.5 h-3.5" />
              <span className="text-[var(--text-primary)] text-xs">Dark</span>
            </button>
            <button
              onClick={() => {
                setTheme("system");
                setIsOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors",
                "hover:bg-[var(--surface-hover)]",
                theme === "system" &&
                  "bg-[var(--surface-hover)] text-[var(--green)]"
              )}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="text-[var(--text-primary)] text-xs">System</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
