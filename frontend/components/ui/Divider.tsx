/**
 * Divider component
 */
"use client";

import { cn } from "@/lib/utils";

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
  label?: string;
}

export default function Divider({
  orientation = "horizontal",
  className,
  label,
}: DividerProps) {
  if (orientation === "vertical") {
    return (
      <div
        className={cn("w-px bg-gray-700 self-stretch", className)}
        role="separator"
        aria-orientation="vertical"
      />
    );
  }

  return (
    <div
      className={cn("flex items-center gap-4 my-4", className)}
      role="separator"
      aria-orientation="horizontal"
    >
      <div className="flex-1 h-px bg-gray-700" />
      {label && (
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      )}
      <div className="flex-1 h-px bg-gray-700" />
    </div>
  );
}
