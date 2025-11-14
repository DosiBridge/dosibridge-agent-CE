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
        "fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-sm",
        className
      )}
    >
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#10a37f] mx-auto mb-4" />
        <p className="text-gray-300 text-lg font-medium">{message}</p>
      </div>
    </div>
  );
}
