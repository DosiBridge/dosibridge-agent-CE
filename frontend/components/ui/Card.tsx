/**
 * Reusable Card component
 */
"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outlined";
  padding?: "none" | "sm" | "md" | "lg";
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, variant = "default", padding = "md", children, ...props },
    ref
  ) => {
    const variants = {
      default: "bg-[var(--surface-elevated)] border border-[var(--border)]",
      elevated:
        "bg-[var(--surface-elevated)] border border-[var(--border)] shadow-lg",
      outlined: "bg-transparent border border-[var(--border)]",
    };

    const paddings = {
      none: "",
      sm: "p-3",
      md: "p-4 sm:p-5",
      lg: "p-6 sm:p-8",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg",
          variants[variant],
          paddings[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export default Card;
