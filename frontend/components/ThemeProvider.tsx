/**
 * Theme provider component to ensure theme is properly initialized
 */
"use client";

import { useStore } from "@/lib/store";
import { useEffect } from "react";

export default function ThemeProvider() {
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);

  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return null; // This component doesn't render anything
}
