/**
 * Toggle switch component
 */
"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    { checked, onChange, label, disabled = false, size = "md", className },
    ref
  ) => {
    const sizes = {
      sm: "w-8 h-4",
      md: "w-11 h-6",
      lg: "w-14 h-7",
    };

    const thumbSizes = {
      sm: "w-3 h-3",
      md: "w-5 h-5",
      lg: "w-6 h-6",
    };

    const translateSizes = {
      sm: "translate-x-4",
      md: "translate-x-5",
      lg: "translate-x-7",
    };

    return (
      <label
        className={cn("flex items-center gap-3 cursor-pointer", className)}
      >
        {label && (
          <span className="text-sm text-[var(--text-primary)]">{label}</span>
        )}
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          className={cn(
            "relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:ring-offset-2 focus:ring-offset-[var(--background)] disabled:opacity-50 disabled:cursor-not-allowed",
            sizes[size],
            checked ? "bg-[var(--green)]" : "bg-[var(--border)]",
            !disabled && "hover:opacity-80"
          )}
        >
          <span
            className={cn(
              "inline-block rounded-full bg-white transform transition-transform duration-200 ease-in-out",
              thumbSizes[size],
              checked ? translateSizes[size] : "translate-x-0.5"
            )}
          />
        </button>
      </label>
    );
  }
);

Switch.displayName = "Switch";

export default Switch;
