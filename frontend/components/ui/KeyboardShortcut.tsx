/**
 * Keyboard shortcut display component
 */
"use client";

import { cn } from "@/lib/utils";

export interface KeyboardShortcutProps {
  keys: string[];
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function KeyboardShortcut({
  keys,
  className,
  size = "md",
}: KeyboardShortcutProps) {
  const sizes = {
    sm: "text-xs px-1 py-0.5",
    md: "text-xs px-1.5 py-0.5",
    lg: "text-sm px-2 py-1",
  };

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((key, index) => (
        <span key={index} className="inline-flex items-center gap-1">
          <kbd
            className={cn(
              "font-mono bg-[#40414f] border border-gray-600 rounded text-gray-300 shadow-sm",
              sizes[size]
            )}
          >
            {key}
          </kbd>
          {index < keys.length - 1 && (
            <span className="text-gray-500 text-xs">+</span>
          )}
        </span>
      ))}
    </div>
  );
}
