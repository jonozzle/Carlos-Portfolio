// components/project/hero-image.tsx
"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { completeHeroTransition } from "@/lib/transitions/hero";

type Props = {
    src: string;
    alt: string;
    slug: string;
};

export default function HeroImage({ src, alt, slug }: Props) {
    const outerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!outerRef.current || typeof window === "undefined") return;

        const id = window.setTimeout(() => {
            completeHeroTransition({
                slug,
                targetEl: outerRef.current!,
                mode: "simple",
            });
        }, 0);

        return () => window.clearTimeout(id);
    }, [slug]);

    return (
        <div
            ref={outerRef}
            data-hero-slug={slug}
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
                <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
                    No image
                </div>
            )}
        </div>
    );
}
