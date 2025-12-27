// lib/transitions/hero.ts
"use client";

import { gsap } from "gsap";
import type { PendingHero } from "@/lib/transitions/state";

type StartHeroTransitionArgs = {
    slug: string;
    sourceEl: HTMLElement;
    imgUrl: string;
    onNavigate: () => void;
};

type CompleteHeroTransitionArgs = {
    slug: string;
    targetEl: HTMLElement | null;
    onDone?: () => void;

    /**
     * mode = "simple"       → move overlay, show target, remove overlay.
     * mode = "parkThenPage" → move overlay, keep parked, fire hero-done;
     *                         PageEnterShell fades content, then cleans up.
     */
    mode?: "simple" | "parkThenPage";
};

function dispatchHeroDone() {
    if (typeof window === "undefined") return;
    try {
        window.dispatchEvent(new CustomEvent("hero-transition-done"));
    } catch {
        // ignore
    }
}

function ensureOverlayImage(sourceEl: HTMLElement, fallbackUrl: string) {
    const imgs = Array.from(sourceEl.querySelectorAll("img"));
    const existing =
        imgs.length > 0 ? (imgs[imgs.length - 1] as HTMLImageElement) : null;

    const hiRes =
        (existing && (existing.currentSrc || existing.src)) || fallbackUrl;

    const img = document.createElement("img");
    img.src = hiRes;
    img.alt = "";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.display = "block";

    return img;
}

/**
 * SOURCE PAGE
 * Create a fixed overlay at the source rect (viewport coordinates),
 * hide the source element, then navigate.
 */
export function startHeroTransition({
    slug,
    sourceEl,
    imgUrl,
    onNavigate,
}: StartHeroTransitionArgs) {
    if (typeof window === "undefined") {
        onNavigate();
        return;
    }

    const fromRect = sourceEl.getBoundingClientRect();

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = `${fromRect.left}px`;
    overlay.style.top = `${fromRect.top}px`;
    overlay.style.width = `${fromRect.width}px`;
    overlay.style.height = `${fromRect.height}px`;
    overlay.style.overflow = "hidden";
    overlay.style.zIndex = "1000";
    overlay.style.pointerEvents = "none";
    overlay.style.willChange = "left, top, width, height, transform";
    overlay.style.transform = "translateZ(0)";

    overlay.appendChild(ensureOverlayImage(sourceEl, imgUrl));
    document.body.appendChild(overlay);

    // Hide source next frame (avoid layout thrash)
    requestAnimationFrame(() => {
        sourceEl.style.transition = "none";
        sourceEl.style.opacity = "0";
        sourceEl.style.visibility = "hidden";
        sourceEl.style.pointerEvents = "none";
    });

    requestAnimationFrame(() => {
        // clear any old overlay
        try {
            if ((window as any).__heroPending?.overlay) {
                (window as any).__heroPending.overlay.remove();
            }
        } catch {
            // ignore
        }

        const pending: PendingHero = { slug, overlay };
        (window as any).__heroPending = pending;

        onNavigate();
    });
}

/**
 * TARGET PAGE
 * Animate overlay (fixed) to the target rect (viewport).
 */
export function completeHeroTransition({
    slug,
    targetEl,
    onDone,
    mode = "simple",
}: CompleteHeroTransitionArgs) {
    if (typeof window === "undefined" || !targetEl) {
        onDone?.();
        return;
    }

    const pending = (window as any).__heroPending as PendingHero | undefined;

    const finishInstant = () => {
        gsap.set(targetEl, { opacity: 1 });

        if (pending?.overlay) {
            try {
                pending.overlay.remove();
            } catch {
                // ignore
            }
        }

        (window as any).__heroPending = undefined;
        dispatchHeroDone();
        onDone?.();
    };

    if (!pending || pending.slug !== slug) {
        finishInstant();
        return;
    }

    const overlay = pending.overlay;

    const run = () => {
        const toRect = targetEl.getBoundingClientRect();
        const fromRect = overlay.getBoundingClientRect();

        const invalid =
            !toRect.width ||
            !toRect.height ||
            Number.isNaN(toRect.left) ||
            Number.isNaN(toRect.top);

        if (invalid) {
            finishInstant();
            return;
        }

        // IMPORTANT: only rect changes; image stays cover inside overlay
        gsap.set(overlay, {
            position: "fixed",
            left: fromRect.left,
            top: fromRect.top,
            width: fromRect.width,
            height: fromRect.height,
            opacity: 1,
        });

        // Hide target while overlay animates
        gsap.set(targetEl, { opacity: 0 });

        const D = 0.9;

        if (mode === "parkThenPage") {
            // Park overlay at target; do not reveal target yet.
            (window as any).__heroPending = { slug, overlay, targetEl };

            gsap.to(overlay, {
                duration: D,
                ease: "power3.inOut",
                left: toRect.left,
                top: toRect.top,
                width: toRect.width,
                height: toRect.height,
                onComplete: () => {
                    dispatchHeroDone();
                    onDone?.();
                },
            });

            return;
        }

        // Simple: overlay -> target, reveal target, remove overlay
        gsap.to(overlay, {
            duration: D,
            ease: "power3.inOut",
            left: toRect.left,
            top: toRect.top,
            width: toRect.width,
            height: toRect.height,
            onComplete: () => {
                gsap.set(targetEl, { opacity: 1 });
                try {
                    overlay.remove();
                } catch {
                    // ignore
                }
                (window as any).__heroPending = undefined;
                dispatchHeroDone();
                onDone?.();
            },
        });
    };

    requestAnimationFrame(run);
}
