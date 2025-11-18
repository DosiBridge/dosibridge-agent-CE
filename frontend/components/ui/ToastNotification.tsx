/**
 * Enhanced toast notification component
 */
"use client";

import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

export interface ToastNotificationProps {
  id: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  duration?: number;
  onClose: (id: string) => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const styles = {
  success: {
    icon: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
  },
  error: {
    icon: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
  warning: {
    icon: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
  },
  info: {
    icon: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
};

export default function ToastNotification({
  id,
  message,
  type = "info",
  duration = 4000,
  onClose,
  action,
}: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Auto-dismiss
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  const Icon = icons[type];
  const style = styles[type];

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border shadow-lg max-w-md transition-all duration-300",
        style.bg,
        style.border,
        isVisible && !isLeaving
          ? "translate-x-0 opacity-100"
          : "translate-x-full opacity-0"
      )}
    >
      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", style.icon)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {message}
        </p>
        {action && (
          <button
            onClick={() => {
              action.onClick();
              handleClose();
            }}
            className="mt-2 text-xs font-medium text-[var(--green)] hover:text-[var(--green-hover)] transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
      <button
        onClick={handleClose}
        className="p-1 hover:bg-[var(--surface-hover)] rounded transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-[var(--text-secondary)]" />
      </button>
    </div>
  );
}
