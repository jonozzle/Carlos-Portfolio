// page-fade
// lib/transitions/page-fade.ts
"use client";

import { gsap } from "gsap";

type FadeOpts = {
    duration?: number;
};

declare global {
    interface Window {
        __pageFadeOutPending?: boolean;
        __fadeOverlayActive?: boolean;
    }
}

function prefersReducedMotion() {
    if (typeof window === "undefined") return false;
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function getTransitionLayer(): HTMLDivElement | null {
    if (typeof document === "undefined") return null;
    return document.getElementById("transition-layer") as HTMLDivElement | null;
}

function currentBgColor(): string {
    if (typeof document === "undefined") return "#ffffff";

    try {
        const v = getComputedStyle(document.documentElement)
            .getPropertyValue("--bg-color")
            .trim();
        if (v) return v;
    } catch {
        // ignore
    }

    try {
        const b = getComputedStyle(document.body).backgroundColor;
        if (b) return b;
    } catch {
        // ignore
    }

    return "#ffffff";
}

/**
 * Cross-fades OUT the current page:
 * - transition-layer fades IN (to hide theme/app mount gap)
 * - #page-root fades OUT
 * Leaves the overlay at opacity:1 for the next page to fade under.
 */
export function fadeOutPageRoot(opts: FadeOpts = {}): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();

    const pageRoot = document.getElementById("page-root");
    const layer = getTransitionLayer();

    // Enforce a minimum so your call-sites using 0.26 don't snap.
    const requested = typeof opts.duration === "number" ? opts.duration : 0.6;
    const duration = Math.max(0.6, requested);

    // Guard: if a fade-out is already in progress, don’t start another.
    if ((window as any).__pageFadeOutPending) return Promise.resolve();
    (window as any).__pageFadeOutPending = true;

    return new Promise<void>((resolve) => {
        const done = () => {
            (window as any).__pageFadeOutPending = false;
            resolve();
        };

        if (prefersReducedMotion()) {
            try {
                if (layer) {
                    (window as any).__fadeOverlayActive = true;
                    gsap.set(layer, {
                        opacity: 1,
                        background: currentBgColor(),
                        willChange: "opacity",
                        pointerEvents: "none",
                    });
                }
                if (pageRoot) gsap.set(pageRoot, { opacity: 0 });
            } finally {
                done();
            }
            return;
        }

        // Prep overlay
        if (layer) {
            (window as any).__fadeOverlayActive = true;

            gsap.killTweensOf(layer);
            gsap.set(layer, {
                opacity: 0,
                background: currentBgColor(),
                willChange: "opacity",
                pointerEvents: "none",
            });
        }

        // Prep page root
        if (pageRoot) {
            gsap.killTweensOf(pageRoot);
            gsap.set(pageRoot, { opacity: 1 });
        }

        // Crossfade: page -> 0 while overlay -> 1
        const tl = gsap.timeline({
            defaults: { ease: "power2.inOut" },
            onComplete: done,
        });

        if (layer) tl.to(layer, { opacity: 1, duration, overwrite: "auto" }, 0);
        if (pageRoot) tl.to(pageRoot, { opacity: 0, duration, overwrite: "auto" }, 0);
        if (!layer && !pageRoot) tl.to({}, { duration }, 0);
    });
}
