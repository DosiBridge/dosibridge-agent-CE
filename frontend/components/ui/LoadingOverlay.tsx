/**
 * Full-screen loading overlay
 */
"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
}

export default function LoadingOverlay({
  isLoading,
  message = "Loading...",
  className,
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-[var(--modal-overlay)] backdrop-blur-sm",
        className
      )}
    >
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[var(--green)] mx-auto mb-4" />
        <p className="text-[var(--text-primary)] text-lg font-medium">
          {message}
        </p>
      </div>
    </div>
  );
}
