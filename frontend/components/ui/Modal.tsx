/**
 * Reusable Modal component
 */
"use client";

import { useClickOutside } from "@/hooks/useClickOutside";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { ReactNode, useEffect, useRef } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showCloseButton = true,
  closeOnClickOutside = true,
  closeOnEscape = true,
  className,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useClickOutside(modalRef, () => {
    if (closeOnClickOutside && isOpen) {
      onClose();
    }
  });

  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    full: "max-w-full mx-4",
  };

  return (
    <div className="fixed inset-0 bg-[var(--modal-overlay)] z-50 flex items-center justify-center p-2 sm:p-3 md:p-4">
      <div
        ref={modalRef}
        className={cn(
          "bg-[var(--modal-bg)] rounded-xl shadow-2xl w-full flex flex-col border border-[var(--border)] max-h-[95vh] sm:max-h-[90vh]",
          sizes[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 border-b border-[var(--border)] shrink-0">
            {title && (
              <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors touch-manipulation"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
