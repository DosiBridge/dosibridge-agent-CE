/**
 * Error display component
 */
"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import Button from "./Button";

export interface ErrorDisplayProps {
  error: Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  title?: string;
}

export default function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className,
  title = "Something went wrong",
}: ErrorDisplayProps) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return (
    <div
      className={cn(
        "p-4 bg-red-500/10 border border-red-500/30 rounded-lg",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-400 mb-1">{title}</h4>
          <p className="text-sm text-gray-300">{errorMessage}</p>
          {(onRetry || onDismiss) && (
            <div className="flex items-center gap-2 mt-3">
              {onRetry && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRetry}
                  className="flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </Button>
              )}
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
