// components/page/page-hero-image.tsx
"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { completeHeroTransition } from "@/lib/hero-transition";

type Props = {
    src: string;
    alt: string;
    slug: string; // page slug (params.slug)
};

export default function PageHeroImage({ src, alt, slug }: Props) {
    const outerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (typeof window === "undefined" || !outerRef.current) return;

        const id = window.setTimeout(() => {
            completeHeroTransition({
                slug,
                targetEl: outerRef.current,
                // simple mode is what you want for Home → Page
            });
        }, 50);

        return () => window.clearTimeout(id);
    }, [slug]);

    return (
        <div
            ref={outerRef}
            data-hero-slug={slug}
            className="relative h-full w-full overflow-hidden"
        >
            {src ? (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    className="object-cover"
                    priority
                />
            ) : (
                <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
                    No image
                </div>
            )}
        </div>
    );
}
