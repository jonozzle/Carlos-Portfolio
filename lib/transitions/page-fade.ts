// lib/transitions/page-fade.ts
"use client";

import { gsap } from "gsap";

type FadeOpts = {
    duration?: number;
};

function prefersReducedMotion() {
    if (typeof window === "undefined") return false;
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/**
 * Fades #page-root to opacity:0 and resolves when done.
 * Guards against double-click / re-entrancy.
 */
export function fadeOutPageRoot(opts: FadeOpts = {}): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();

    const pageRoot = document.getElementById("page-root");
    if (!pageRoot) return Promise.resolve();

    // Guard: if a fade-out is already in progress, don’t start another.
    if ((window as any).__pageFadeOutPending) return Promise.resolve();
    (window as any).__pageFadeOutPending = true;

    const duration = typeof opts.duration === "number" ? opts.duration : 0.24;

    return new Promise<void>((resolve) => {
        const done = () => {
            (window as any).__pageFadeOutPending = false;
            resolve();
        };

        gsap.killTweensOf(pageRoot);

        if (prefersReducedMotion()) {
            gsap.set(pageRoot, { opacity: 0 });
            done();
            return;
        }

        gsap.to(pageRoot, {
            opacity: 0,
            duration,
            ease: "power2.inOut",
            overwrite: "auto",
            onComplete: done,
        });
    });
}
