// components/footer/home-footer.tsx
"use client";

import { useRef, useMemo, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { StylizedLabel } from "@/components/ui/stylised-label";
import SmoothImage from "@/components/ui/smooth-image";
import type { FooterData } from "@/sanity/lib/fetch";
import { predecodeNextImages } from "@/lib/predecode";

type FooterLink = NonNullable<FooterData["links"]>[number];
type FooterImage = NonNullable<FooterData["images"]>[number];

type Props = {
    footer: FooterData;
};

export default function HomeFooter({ footer }: Props) {
    const container = useRef<HTMLDivElement>(null);
    const marqueeTrack = useRef<HTMLDivElement>(null);
    const tweenRef = useRef<gsap.core.Tween | null>(null);

    const title = footer.title ?? "";
    const links = (footer.links ?? []) as FooterLink[];
    const images = (footer.images ?? []) as FooterImage[];
    const copyright = footer.copyright ?? "";

    const hasImages = images.length > 0;

    // Double the array for infinite loop
    const scrollingImages = useMemo(
        () => (hasImages ? [...images, ...images] : []),
        [images, hasImages]
    );

    // 1. GSAP marquee tween (created once per data change, stays paused by default)
    useGSAP(
        () => {
            if (!hasImages || !marqueeTrack.current) return;

            // Kill any existing tween before creating a new one
            tweenRef.current?.kill();

            tweenRef.current = gsap.to(marqueeTrack.current, {
                yPercent: -50,
                ease: "none",
                duration: 30,
                repeat: -1,
                force3D: true,
                paused: true,
            });

            return () => {
                tweenRef.current?.kill();
                tweenRef.current = null;
            };
        },
        { scope: container, dependencies: [hasImages] }
    );



    return (
        <section
            ref={container}
            className="w-[100vw] h-screen flex-shrink-0 grid grid-cols-12 gap-2 overflow-hidden"
            style={{
                contain: "layout paint style",
            }}
        >
            {/* LEFT SIDE */}
            <div className="col-span-12 md:col-span-6 h-full flex px-4 py-6 md:px-8 md:py-10">
                <div className="flex flex-col items-start justify-center gap-6 w-full">
                    {title ? (
                        <h2 className="text-3xl md:text-5xl font-serif tracking-tight leading-none">
                            <StylizedLabel text={title} animateOnScroll />
                        </h2>
                    ) : null}

                    {links.length > 0 && (
                        <div className="flex flex-wrap gap-3 md:gap-4 text-xs md:text-sm">
                            {links.map((link) => {
                                if (!link?.href || !link?.label) return null;
                                return (
                                    <a
                                        key={link._key}
                                        href={link.href}
                                        className="underline underline-offset-4 decoration-1 hover:opacity-70 transition-opacity"
                                    >
                                        {link.label}
                                    </a>
                                );
                            })}
                        </div>
                    )}

                    {copyright ? (
                        <p className="text-xs md:text-sm opacity-60">{copyright}</p>
                    ) : null}
                </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="col-span-12 md:col-span-6 h-full overflow-hidden relative transform-gpu">
                {hasImages ? (
                    <div className="relative h-full w-full overflow-hidden">
                        <div
                            ref={marqueeTrack}
                            className="flex flex-col w-full will-change-transform transform-gpu "
                        >
                            {scrollingImages.map((img, i) => {
                                if (!img?.url) return null;
                                const isFirst = i === 0;

                                return (
                                    <div key={`${img._key}-${i}`} className="w-full flex-shrink-0">
                                        <div className="relative w-full aspect-[3/4] overflow-hidden contain-paint will-change-transform transform-gpu">
                                            <SmoothImage
                                                src={img.url}
                                                alt={img.alt ?? ""}
                                                hiMaxWidth={900} // smaller file
                                                sizes="(max-width: 768px) 100vw, 50vw"
                                                objectFit="cover"
                                                // These pass through to NextImage
                                                quality={80}
                                                priority={isFirst}
                                                loading={isFirst ? "eager" : "lazy"}
                                                fetchPriority={isFirst ? "high" : "low"}
                                                lqipWidth={16}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-xs opacity-60 border border-dashed">
                        Add images to sanity
                    </div>
                )}
            </div>
        </section>
    );
}
