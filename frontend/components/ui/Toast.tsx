/**
 * Enhanced toast notifications
 */
"use client";

import { AlertCircle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { toast as hotToast } from "react-hot-toast";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastOptions {
  duration?: number;
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

const colors = {
  success: "text-green-400",
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-blue-400",
};

export function showToast(
  message: string,
  type: ToastType = "info",
  options?: ToastOptions
) {
  const Icon = icons[type];
  const iconColor = colors[type];

  return hotToast(
    (t) => (
      <div className="flex items-start gap-3 max-w-md">
        <Icon className={`w-5 h-5 ${iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200">{message}</p>
          {options?.action && (
            <button
              onClick={() => {
                options.action?.onClick();
                hotToast.dismiss(t.id);
              }}
              className="mt-2 text-xs font-medium text-[#10a37f] hover:text-[#0d8f6e] transition-colors"
            >
              {options.action.label}
            </button>
          )}
        </div>
        <button
          onClick={() => hotToast.dismiss(t.id)}
          className="p-1 hover:bg-gray-700 rounded transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    ),
    {
      duration: options?.duration || 4000,
      style: {
        background: "#343541",
        color: "#fff",
        borderRadius: "12px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
        padding: "16px",
      },
    }
  );
}

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    showToast(message, "success", options),
  error: (message: string, options?: ToastOptions) =>
    showToast(message, "error", options),
  warning: (message: string, options?: ToastOptions) =>
    showToast(message, "warning", options),
  info: (message: string, options?: ToastOptions) =>
    showToast(message, "info", options),
};
