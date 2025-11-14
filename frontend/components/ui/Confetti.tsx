/**
 * Confetti animation component for celebrations
 */
"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export interface ConfettiProps {
  trigger: boolean;
  duration?: number;
  particleCount?: number;
  className?: string;
}

export default function Confetti({
  trigger,
  duration = 3000,
  particleCount = 50,
  className,
}: ConfettiProps) {
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      left: number;
      delay: number;
      duration: number;
      color: string;
    }>
  >([]);

  useEffect(() => {
    if (!trigger) {
      setParticles([]);
      return;
    }

    const colors = [
      "#10a37f",
      "#0d8f6e",
      "#3b82f6",
      "#8b5cf6",
      "#ec4899",
      "#f59e0b",
    ];

    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 500,
      duration: duration + Math.random() * 1000,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    setParticles(newParticles);

    const timer = setTimeout(() => {
      setParticles([]);
    }, duration + 1000);

    return () => clearTimeout(timer);
  }, [trigger, duration, particleCount]);

  if (particles.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 pointer-events-none z-50 overflow-hidden",
        className
      )}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full animate-confetti-fall"
          style={{
            left: `${particle.left}%`,
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}ms`,
            animationDuration: `${particle.duration}ms`,
          }}
        />
      ))}
    </div>
  );
}
