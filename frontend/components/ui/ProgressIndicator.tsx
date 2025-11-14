/**
 * Progress indicator for long-running operations
 */
"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export interface ProgressIndicatorProps {
  isLoading: boolean;
  message?: string;
  progress?: number; // 0-100
  className?: string;
}

export default function ProgressIndicator({
  isLoading,
  message,
  progress,
  className,
}: ProgressIndicatorProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 bg-[#343541] border border-gray-700 rounded-lg shadow-xl p-4 min-w-[200px] animate-scale-in",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#10a37f] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200">
            {message || "Processing"}
            {dots}
          </p>
          {progress !== undefined && (
            <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-[#10a37f] transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
