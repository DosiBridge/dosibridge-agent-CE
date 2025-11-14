/**
 * Custom hook for input history (up/down arrow navigation)
 */
import { useRef, useState } from "react";

export function useInputHistory(maxHistory: number = 50) {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const currentInputRef = useRef<string>("");

  const addToHistory = (input: string) => {
    if (!input.trim()) return;

    setHistory((prev) => {
      // Remove duplicates and add to beginning
      const filtered = prev.filter((item) => item !== input);
      return [input, ...filtered].slice(0, maxHistory);
    });
    setHistoryIndex(-1);
    currentInputRef.current = "";
  };

  const navigateHistory = (direction: "up" | "down"): string | null => {
    if (history.length === 0) return null;

    let newIndex = historyIndex;

    if (direction === "up") {
      // Save current input if we're at the start
      if (historyIndex === -1) {
        currentInputRef.current = "";
      }
      newIndex =
        historyIndex < history.length - 1
          ? historyIndex + 1
          : history.length - 1;
    } else {
      // Down arrow
      if (historyIndex === 0) {
        // Return to current input
        setHistoryIndex(-1);
        return currentInputRef.current || null;
      }
      newIndex = historyIndex > 0 ? historyIndex - 1 : -1;
    }

    setHistoryIndex(newIndex);
    return newIndex >= 0 ? history[newIndex] : currentInputRef.current || null;
  };

  const saveCurrentInput = (input: string) => {
    if (historyIndex === -1) {
      currentInputRef.current = input;
    }
  };

  return {
    addToHistory,
    navigateHistory,
    saveCurrentInput,
    historyLength: history.length,
  };
}
