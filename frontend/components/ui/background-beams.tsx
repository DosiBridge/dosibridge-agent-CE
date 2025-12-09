"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const BackgroundBeams = ({ className }: { className?: string }) => {
    return (
        <div
            className={cn(
                "absolute h-full w-full inset-0 z-0 bg-neutral-950 flex flex-col items-center justify-center antialiased",
                className
            )}
        >
            <div className="absolute left-0 top-0 h-full w-full [mask-image:linear-gradient(to_bottom,white,transparent)]">
                <div className="absolute inset-0 bg-slate-950 [mask-image:radial-gradient(transparent,white)] pointer-events-none" />
                <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 696 316"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 w-full h-full opacity-20"
                >
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "linear",
                        }}
                        d="M3 0V315.5"
                        stroke="#52525B"
                        strokeOpacity="0.2"
                    />
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "linear",
                            delay: 1,
                        }}
                        d="M34 0V315.5"
                        stroke="#52525B"
                        strokeOpacity="0.2"
                    />
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "linear",
                            delay: 0.5,
                        }}
                        d="M66 0V315.5"
                        stroke="#52525B"
                        strokeOpacity="0.2"
                    />
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "linear",
                            delay: 1.5,
                        }}
                        d="M98 0V315.5"
                        stroke="#52525B"
                        strokeOpacity="0.2"
                    />
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                            duration: 2.2,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "linear",
                            delay: 0.2,
                        }}
                        d="M129 0V315.5"
                        stroke="#52525B"
                        strokeOpacity="0.2"
                    />
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                            duration: 3.5,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "linear",
                            delay: 0.8,
                        }}
                        d="M161 0V315.5"
                        stroke="#52525B"
                        strokeOpacity="0.2"
                    />
                    {/* A few diagonal beams for effect */}
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "linear",
                        }}
                        d="M-50 0 L150 316"
                        stroke="#6366f1"
                        strokeOpacity="0.1"
                        strokeWidth="2"
                    />
                    <motion.path
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{
                            duration: 7,
                            repeat: Infinity,
                            repeatType: "loop",
                            ease: "linear",
                            delay: 2
                        }}
                        d="M600 0 L400 316"
                        stroke="#6366f1"
                        strokeOpacity="0.1"
                        strokeWidth="2"
                    />
                </svg>
            </div>

        </div>
    );
};
