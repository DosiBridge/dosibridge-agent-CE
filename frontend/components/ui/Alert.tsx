/**
 * Alert component for notifications and messages
 */
"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { ReactNode } from "react";

export interface AlertProps {
  variant?: "success" | "error" | "warning" | "info";
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  icon?: ReactNode;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const styles = {
  success: {
    container: "bg-green-500/10 border-green-500/30 text-green-400",
    icon: "text-green-400",
  },
  error: {
    container: "bg-red-500/10 border-red-500/30 text-red-400",
    icon: "text-red-400",
  },
  warning: {
    container: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    icon: "text-yellow-400",
  },
  info: {
    container: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    icon: "text-blue-400",
  },
};

export default function Alert({
  variant = "info",
  title,
  children,
  onClose,
  className,
  icon,
}: AlertProps) {
  const Icon = icon || icons[variant];
  const style = styles[variant];

  return (
    <div
      className={cn(
        "relative flex gap-3 p-4 rounded-lg border",
        style.container,
        className
      )}
      role="alert"
    >
      <div className={cn("shrink-0", style.icon)}>
        {typeof Icon === "function" ? <Icon className="w-5 h-5" /> : Icon}
      </div>
      <div className="flex-1 min-w-0">
        {title && <h4 className="font-semibold mb-1 text-sm">{title}</h4>}
        <div className="text-sm">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Close alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
