// HeroImage
// components/project/hero-image.tsx
"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { completeHeroTransition } from "@/lib/hero-transition";

type Props = {
    src: string;
    alt: string;
    slug: string;
};

export default function HeroImage({ src, alt, slug }: Props) {
    const outerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (typeof window === "undefined" || !outerRef.current) return;

        const el = outerRef.current;

        const pending = (window as any).__heroPending as { slug?: string } | undefined;
        const hasHeroFlight = !!pending && pending.slug === slug;

        if (hasHeroFlight) {
            // Wait a frame so layout + ScrollSmoother settle before measuring.
            const raf = requestAnimationFrame(() => {
                completeHeroTransition({
                    slug,
                    targetEl: el,
                    mode: "simple",
                });
            });

            return () => cancelAnimationFrame(raf);
        }

        // No overlay flight: fade in
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
    }, [slug]);

    return (
        <div
            ref={outerRef}
            data-hero-slug={slug}
            data-hero-target="project"
            className="relative h-full w-full overflow-hidden"
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
