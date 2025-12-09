"use client";
import React, { useEffect, useState } from "react";
import { useId } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { cn } from "@/lib/utils";

type ParticlesProps = {
    id?: string;
    className?: string;
    background?: string;
    particleSize?: number;
    minSize?: number;
    maxSize?: number;
    speed?: number;
    particleColor?: string;
    particleDensity?: number;
};

export const SparklesCore = (props: ParticlesProps) => {
    const {
        id,
        className,
        background,
        minSize,
        maxSize,
        speed,
        particleColor,
        particleDensity,
    } = props;

    const [init, setInit] = useState(false);

    useEffect(() => {
        initParticlesEngine(async (engine) => {
            await loadSlim(engine);
        }).then(() => {
            setInit(true);
        });
    }, []);

    const generatedId = useId();

    if (!init) return null; // Or a loading component

    return (
        <div className={cn("w-full h-full", className)}>
            <Particles
                id={id || generatedId}
                className={cn("h-full w-full")}
                options={{
                    background: {
                        color: {
                            value: background || "#0d47a1",
                        },
                    },
                    fullScreen: {
                        enable: false,
                        zIndex: 1,
                    },
                    fpsLimit: 120,
                    interactivity: {
                        events: {
                            onClick: {
                                enable: true,
                                mode: "push",
                            },
                            onHover: {
                                enable: false,
                                mode: "repulse",
                            },
                            resize: {
                                enable: true,
                                delay: 0.5,
                            },
                        },
                        modes: {
                            push: {
                                quantity: 4,
                            },
                            repulse: {
                                distance: 200,
                                duration: 0.4,
                            },
                        },
                    },
                    particles: {
                        bounce: {
                            horizontal: {
                                value: 1,
                            },
                            vertical: {
                                value: 1,
                            },
                        },
                        color: {
                            value: particleColor || "#ffffff",
                        },
                        links: {
                            color: particleColor || "#ffffff",
                            distance: 150,
                            enable: false,
                            opacity: 0.5,
                            width: 1,
                        },
                        move: {
                            direction: "none",
                            enable: true,
                            outModes: {
                                default: "bounce",
                            },
                            random: false,
                            speed: speed || 6,
                            straight: false,
                        },
                        number: {
                            density: {
                                enable: true,
                                width: 400,
                                height: 400,
                            },
                            value: particleDensity || 80,
                        },
                        opacity: {
                            value: 0.5,
                        },
                        shape: {
                            type: "circle",
                        },
                        size: {
                            value: { min: minSize || 1, max: maxSize || 3 },
                        },
                    },
                    detectRetina: true,
                }}
            />
        </div>
    );
};
