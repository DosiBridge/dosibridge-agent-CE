/**
 * Backdrop component for modals and overlays
 */
"use client";

import { cn } from "@/lib/utils";
import { useEffect } from "react";

export interface BackdropProps {
  isOpen: boolean;
  onClick?: () => void;
  className?: string;
  blur?: boolean;
}

export default function Backdrop({
  isOpen,
  onClick,
  className,
  blur = true,
}: BackdropProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 bg-black/50 transition-opacity",
        blur && "backdrop-blur-sm",
        className
      )}
      onClick={onClick}
      aria-hidden="true"
    />
  );
}
