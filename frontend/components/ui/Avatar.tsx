/**
 * Avatar component
 */
"use client";

import { cn } from "@/lib/utils";
import { User } from "lucide-react";

export interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  status?: "online" | "offline" | "away";
}

export default function Avatar({
  src,
  alt,
  name,
  size = "md",
  className,
  status,
}: AvatarProps) {
  const sizes = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg",
  };

  const statusSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
    xl: "w-3 h-3",
  };

  const statusColors = {
    online: "bg-green-500",
    offline: "bg-gray-500",
    away: "bg-yellow-500",
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <div
        className={cn(
          "rounded-full bg-[#40414f] flex items-center justify-center text-gray-300 overflow-hidden",
          sizes[size]
        )}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name}
            className="w-full h-full object-cover"
          />
        ) : name ? (
          <span>{getInitials(name)}</span>
        ) : (
          <User className="w-1/2 h-1/2" />
        )}
      </div>
      {status && (
        <div
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-[#343541]",
            statusSizes[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  );
}
