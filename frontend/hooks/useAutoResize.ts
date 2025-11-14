/**
 * Custom hook for auto-resizing textarea
 */
import { RefObject, useEffect } from "react";

export function useAutoResize(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  minRows: number = 1,
  maxRows: number = 8
) {
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Calculate the number of rows
    const lineHeight = parseInt(
      window.getComputedStyle(textarea).lineHeight || "20",
      10
    );
    const padding =
      parseInt(window.getComputedStyle(textarea).paddingTop || "0", 10) +
      parseInt(window.getComputedStyle(textarea).paddingBottom || "0", 10);

    const scrollHeight = textarea.scrollHeight;
    const rows = Math.floor((scrollHeight - padding) / lineHeight);

    // Clamp rows between min and max
    const clampedRows = Math.max(minRows, Math.min(maxRows, rows));

    // Set the height
    textarea.style.height = `${clampedRows * lineHeight + padding}px`;
    textarea.style.overflowY = rows > maxRows ? "auto" : "hidden";
  }, [value, textareaRef, minRows, maxRows]);
}
