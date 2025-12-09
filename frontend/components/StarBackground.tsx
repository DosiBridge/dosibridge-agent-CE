"use client";

import { useEffect, useState } from "react";

export default function StarBackground() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const container = document.getElementById('stars-container');
        if (container && container.childElementCount === 0) {
            for (let i = 0; i < 100; i++) {
                const star = document.createElement('div');
                star.className = 'star';
                star.classList.add(`star-layer-${(i % 3) + 1}`);
                star.style.left = `${Math.random() * 100}%`;
                star.style.top = `${Math.random() * 100}%`;
                star.style.animationDelay = `${Math.random() * 5}s`;
                container.appendChild(star);
            }
        }
    }, []);

    if (!mounted) return null;

    return (
        <div
            id="stars-container"
            className="stars-container opacity-60 pointer-events-none fixed inset-0 z-[-1]"
        />
    );
}
