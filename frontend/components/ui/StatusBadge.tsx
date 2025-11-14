/**
 * Status badge component
 */
"use client";

import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

export interface StatusBadgeProps {
  status: "success" | "error" | "warning" | "pending" | "loading";
  label: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  pending: Clock,
  loading: Loader2,
};

const styles = {
  success: "bg-green-500/10 text-green-400 border-green-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
  warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  pending: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  loading: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

const sizes = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5",
};

export default function StatusBadge({
  status,
  label,
  className,
  size = "md",
}: StatusBadgeProps) {
  const Icon = icons[status];
  const isAnimated = status === "loading";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        styles[status],
        sizes[size],
        className
      )}
    >
      <Icon
        className={cn("w-3.5 h-3.5 shrink-0", isAnimated && "animate-spin")}
      />
      <span>{label}</span>
    </div>
  );
}
