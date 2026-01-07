// components/project/hero-image.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { completeHeroTransition } from "@/lib/hero-transition";

type Props = {
    src: string;
    alt: string;
    slug: string;

    /**
     * autoWidth:
     * - <md: ratio-sized box (no h-full), image object-contain
     * - md+: full-height box with aspect-ratio driving width
     */
    autoWidth?: boolean;

    className?: string;
};

export default function HeroImage({
    src,
    alt,
    slug,
    autoWidth = false,
    className = "",
}: Props) {
    const outerRef = useRef<HTMLDivElement | null>(null);

    const [ar, setAr] = useState<number | null>(null); // width/height
    const arLockedRef = useRef(false);
    const didCompleteRef = useRef(false);

    // Resolve aspect ratio once (and then lock it once we complete a hero flight)
    useEffect(() => {
        if (!autoWidth) return;
        if (typeof window === "undefined") return;
        if (!src) return;
        if (ar && ar > 0) return;

        // Prefer the overlay image if present (usually already loaded / correct)
        const pending = (window as any).__heroPending as any;
        const overlayImg: HTMLImageElement | undefined = pending?.overlayImg;

        const maybeSet = (w: number, h: number) => {
            if (arLockedRef.current) return;
            if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
            setAr(w / h);
        };

        if (overlayImg) {
            const ow = overlayImg.naturalWidth;
            const oh = overlayImg.naturalHeight;

            if (ow > 0 && oh > 0) {
                maybeSet(ow, oh);
                return;
            }

            const onLoad = () => maybeSet(overlayImg.naturalWidth, overlayImg.naturalHeight);
            overlayImg.addEventListener("load", onLoad, { once: true });
            return () => overlayImg.removeEventListener("load", onLoad);
        }

        // Fallback: preload the src to get natural dims
        const img = new window.Image();
        img.decoding = "async";
        img.onload = () => maybeSet(img.naturalWidth, img.naturalHeight);
        img.onerror = () => {
            // if it truly fails, pick a stable fallback and don't update later
            if (!arLockedRef.current) setAr(16 / 9);
        };
        img.src = src;

        if (img.complete) {
            maybeSet(img.naturalWidth, img.naturalHeight);
        }

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [autoWidth, src, ar]);

    useEffect(() => {
        if (typeof window === "undefined" || !outerRef.current) return;

        const el = outerRef.current;

        const pending = (window as any).__heroPending as { slug?: string } | undefined;
        const hasHeroFlight = !!pending && pending.slug === slug;

        // For autoWidth, do not complete until AR is known and the box has rendered with it.
        if (hasHeroFlight) {
            if (autoWidth && (!ar || ar <= 0)) return;
            if (didCompleteRef.current) return;
            didCompleteRef.current = true;

            // Lock AR so it cannot change post-flight (prevents the “snap”)
            arLockedRef.current = true;

            // Double RAF gives layout a beat to apply aspectRatio + sizing before measuring rects.
            const raf1 = requestAnimationFrame(() => {
                const raf2 = requestAnimationFrame(() => {
                    completeHeroTransition({ slug, targetEl: el, mode: "simple" });
                });
                (el as any).__heroRaf2 = raf2;
            });
            (el as any).__heroRaf1 = raf1;

            return () => {
                cancelAnimationFrame((el as any).__heroRaf1);
                cancelAnimationFrame((el as any).__heroRaf2);
            };
        }

        // No hero flight: fade in (for autoWidth, wait for AR so we don't fade a wrong-sized box)
        if (autoWidth && (!ar || ar <= 0)) return;

        gsap.killTweensOf(el);
        gsap.set(el, { opacity: 0 });
        gsap.to(el, {
            opacity: 1,
            duration: 0.55,
            ease: "power2.out",
            overwrite: true,
            clearProps: "opacity",
        });

        try {
            window.dispatchEvent(new CustomEvent("hero-page-hero-show", { detail: { slug } }));
        } catch {
            // ignore
        }
    }, [slug, autoWidth, ar]);

    // Default mode (keeps other pages unchanged)
    if (!autoWidth) {
        return (
            <div
                ref={outerRef}
                data-hero-slug={slug}
                data-hero-target="project"
                className={`relative h-full w-full overflow-hidden ${className}`.trim()}
                style={{ opacity: 0 }}
            >
                {src ? (
                    <Image
                        src={src}
                        alt={alt}
                        fill
                        priority
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                    />
                ) : (
                    <div className="absolute inset-0 grid place-items-center text-xs opacity-60">No image</div>
                )}
            </div>
        );
    }

    // autoWidth mode:
    // - MOBILE: ratio box (no h-full) so the hero overlay lands at the correct size (no snap)
    // - MD+: full-height + aspect-ratio drives width
    return (
        <div
            ref={outerRef}
            data-hero-slug={slug}
            data-hero-target="project"
            className={`
      relative overflow-hidden
      w-full md:w-auto
      h-auto md:h-full
      max-h-[70vh] md:max-h-none
      ${className}
    `.trim()}
            style={{
                opacity: 0,
                aspectRatio: ar && ar > 0 ? ar : undefined,
            }}
        >
            {src ? (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    priority
                    className="object-contain"
                    sizes="100vw"
                />
            ) : (
                <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
                    No image
                </div>
            )}
        </div>
    );

}
