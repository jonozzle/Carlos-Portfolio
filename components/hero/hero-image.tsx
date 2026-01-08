// components/project/hero-image.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { completeHeroTransition } from "@/lib/hero-transition";
import type { PendingHero } from "@/lib/transitions/state";

type Props = {
    src: string;
    alt: string;
    slug: string;
    autoWidth?: boolean;
    className?: string;
    /** Seed AR (e.g. from Sanity) to avoid layout shifts. */
    initialAR?: number;
};

function isGoodAR(n: number) {
    return Number.isFinite(n) && n > 0.05 && n < 20;
}

function safeAR(n: number | null | undefined, fallback = 1) {
    if (typeof n !== "number") return fallback;
    return isGoodAR(n) ? n : fallback;
}

export default function HeroImage({
    src,
    alt,
    slug,
    autoWidth = false,
    className = "",
    initialAR,
}: Props) {
    const outerRef = useRef<HTMLDivElement | null>(null);

    // IMPORTANT:
    // This flag prevents the "non-hero nav fade-in" from running again after a hero completion.
    // Without this, an AR update (or any dependency change) can re-trigger opacity:0 -> 1,
    // causing the flash you described.
    const didCompleteRef = useRef(false);

    // Seed from Sanity AR if present to avoid layout shift + scroll plumbing hitches.
    const [ar, setAr] = useState<number>(() => safeAR(initialAR, 1));

    // Resolve mobile at first client render (no “desktop-first” flash on mobile).
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return window.matchMedia("(max-width: 767px)").matches;
    });

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mq = window.matchMedia("(max-width: 767px)");
        const onChange = () => setIsMobile(mq.matches);

        onChange();

        if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
        else (mq as any).addListener(onChange);

        return () => {
            if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onChange);
            else (mq as any).removeListener(onChange);
        };
    }, []);

    const computedStyle = useMemo((): CSSProperties | undefined => {
        if (!autoWidth) return undefined;

        const ratio = safeAR(ar, 1);

        // MOBILE:
        // - landscape => full width, auto height
        // - portrait  => height-limited, auto width
        if (isMobile) {
            const portrait = ratio < 1;

            if (portrait) {
                return {
                    aspectRatio: String(ratio),
                    height: "min(70vh, 100%)",
                    width: "auto",
                    maxWidth: "100%",
                    maxHeight: "70vh",
                    marginLeft: "auto",
                    marginRight: "auto",
                };
            }

            return {
                aspectRatio: String(ratio),
                width: "100%",
                height: "auto",
                maxHeight: "70vh",
            };
        }

        // DESKTOP: full height, auto width from AR
        return {
            aspectRatio: String(safeAR(ar, 1)),
            height: "100%",
            width: "auto",
        };
    }, [autoWidth, isMobile, ar]);

    useEffect(() => {
        if (typeof window === "undefined" || !outerRef.current) return;

        const el = outerRef.current;

        const pending = window.__heroPending as PendingHero | undefined;
        const isHeroNav = !!pending && pending.slug === slug;

        // HERO NAV: non-autoWidth can complete immediately once the target exists.
        if (isHeroNav && !autoWidth) {
            if (didCompleteRef.current) return;
            didCompleteRef.current = true;

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    completeHeroTransition({ slug, targetEl: el, mode: "simple" });
                });
            });
            return;
        }

        // HERO NAV: for autoWidth, force final sizing before completing transition.
        if (isHeroNav && autoWidth) {
            const overlayImg = pending?.overlayImg ?? null;

            if (isMobile && overlayImg) {
                try {
                    overlayImg.style.objectFit = "contain";
                } catch {
                    // ignore
                }
            }

            let rafId = 0;
            let timeoutId: number | null = null;
            const start = performance.now();

            const applySizingToTarget = (ratio: number) => {
                const r = safeAR(ratio, 1);

                try {
                    el.style.aspectRatio = String(r);
                } catch {
                    // ignore
                }

                if (isMobile) {
                    if (r < 1) {
                        el.style.height = "min(70vh, 100%)";
                        el.style.width = "auto";
                        el.style.maxWidth = "100%";
                        el.style.maxHeight = "70vh";
                        el.style.marginLeft = "auto";
                        el.style.marginRight = "auto";
                    } else {
                        el.style.width = "100%";
                        el.style.height = "auto";
                        el.style.maxHeight = "70vh";
                        el.style.marginLeft = "";
                        el.style.marginRight = "";
                    }
                } else {
                    el.style.height = "100%";
                    el.style.width = "auto";
                    el.style.maxHeight = "";
                    el.style.maxWidth = "";
                    el.style.marginLeft = "";
                    el.style.marginRight = "";
                }
            };

            const finalize = () => {
                if (didCompleteRef.current) return;
                didCompleteRef.current = true;

                applySizingToTarget(ar);

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        completeHeroTransition({ slug, targetEl: el, mode: "simple" });
                    });
                });
            };

            const tick = () => {
                const w = overlayImg?.naturalWidth ?? 0;
                const h = overlayImg?.naturalHeight ?? 0;

                if (w > 0 && h > 0) {
                    const ratio = w / h;
                    if (isGoodAR(ratio)) {
                        setAr(ratio);
                        applySizingToTarget(ratio);
                        finalize();
                        return;
                    }
                }

                if (performance.now() - start > 250) {
                    finalize();
                    return;
                }

                rafId = requestAnimationFrame(tick);
            };

            rafId = requestAnimationFrame(tick);
            timeoutId = window.setTimeout(() => finalize(), 900);

            return () => {
                cancelAnimationFrame(rafId);
                if (timeoutId) window.clearTimeout(timeoutId);
            };
        }

        // NON-HERO nav:
        // If we've already completed a hero transition into this element, DO NOT run the fade-in again
        // (this is the common cause of the "flash off/on" after the hero finishes).
        if (didCompleteRef.current) {
            try {
                gsap.killTweensOf(el);
            } catch {
                // ignore
            }
            gsap.set(el, { opacity: 1, clearProps: "opacity,visibility,pointerEvents" });
            return;
        }

        // Fresh mount: fade in
        gsap.killTweensOf(el);
        gsap.set(el, { opacity: 0 });
        gsap.to(el, {
            opacity: 1,
            duration: 0.55,
            ease: "power2.out",
            overwrite: true,
        });

        try {
            window.dispatchEvent(new CustomEvent("hero-page-hero-show", { detail: { slug } }));
        } catch {
            // ignore
        }
    }, [slug, autoWidth, isMobile, ar]);

    if (!autoWidth) {
        return (
            <div
                ref={outerRef}
                data-hero-slug={slug}
                data-hero-target="project"
                className={`relative h-full w-full overflow-hidden opacity-0 ${className}`.trim()}
            >
                {src ? (
                    <Image
                        src={src}
                        alt={alt}
                        fill
                        priority
                        className="object-cover [transform:translateZ(0)]"
                        sizes="(max-width: 768px) 100vw, 50vw"
                    />
                ) : (
                    <div className="absolute inset-0 grid place-items-center text-xs opacity-60">No image</div>
                )}
            </div>
        );
    }

    return (
        <div
            ref={outerRef}
            data-hero-slug={slug}
            data-hero-target="project"
            className={`relative overflow-hidden opacity-0 ${className}`.trim()}
            style={computedStyle}
        >
            {src ? (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    priority
                    className="object-contain [transform:translateZ(0)]"
                    sizes="(max-width: 767px) 100vw, 50vw"
                    onLoadingComplete={(img) => {
                        // If we already have a reliable AR (from Sanity), do not update it on load.
                        // Avoids layout shift + scroll/trigger rebuild hitches.
                        if (typeof initialAR === "number" && isGoodAR(initialAR)) return;

                        const w = img?.naturalWidth ?? 0;
                        const h = img?.naturalHeight ?? 0;
                        if (w > 0 && h > 0) {
                            const ratio = w / h;
                            if (isGoodAR(ratio)) setAr(ratio);
                        }
                    }}
                />
            ) : (
                <div className="absolute inset-0 grid place-items-center text-xs opacity-60">No image</div>
            )}
        </div>
    );
}
