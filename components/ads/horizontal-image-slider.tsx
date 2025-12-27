// components/ads/horizontal-image-slider.tsx
"use client";

import { useLayoutEffect, useMemo, useRef, useEffect } from "react";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import clsx from "clsx";
import SmoothImage from "@/components/ui/smooth-image";
import type { AdvertImage } from "@/components/ads/advert";
import { predecodeNextImages } from "@/lib/predecode";

gsap.registerPlugin(ScrollTrigger);

type Props = {
    images?: AdvertImage[] | null;
    className?: string;
    size?: "half" | "full" | "auto";
    label?: string;
    direction?: "horizontal" | "vertical";
};

export default function HorizontalImageSlider({
    images = [],
    className,
    size = "auto",
    label = "Advertisement",
    direction = "horizontal",
}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);

    const prepared = useMemo(
        () =>
            (images ?? [])
                .filter((i) => i?.asset?.url)
                .map((i) => ({
                    src: i!.asset!.url as string,
                    alt: i!.alt ?? "",
                })),
        [images]
    );

    const len = prepared.length;

    // For horizontal, extend with clones so we can "loop" at both ends.
    const renderImages = useMemo(() => {
        if (direction === "vertical") return prepared;
        if (prepared.length <= 1) return prepared;
        const first = prepared[0];
        const last = prepared[prepared.length - 1];
        return [last, ...prepared, first];
    }, [prepared, direction]);

    const renderLen = renderImages.length;

    // Pre-decode slider images as this block approaches the viewport
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!containerRef.current) return;
        if (!len) return;

        const rootEl = containerRef.current;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting || entry.intersectionRatio > 0) {
                    predecodeNextImages(rootEl, Math.min(len, 6));
                    observer.disconnect();
                }
            },
            {
                root: null,
                rootMargin: "50% 0px",
                threshold: 0,
            }
        );

        observer.observe(rootEl);

        return () => observer.disconnect();
    }, [len]);

    useLayoutEffect(() => {
        if (!len) return;
        if (typeof window === "undefined") return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const container = containerRef.current;
        const track = trackRef.current;
        if (!container || !track) return;

        const scroller = window;

        const ctx = gsap.context(() => {
            let follower: ScrollTrigger | null = null;
            let tween: gsap.core.Tween | null = null;
            let ready = false;

            const buildHorizontal = () => {
                follower?.kill();
                follower = null;
                tween?.kill();
                tween = null;

                // Measure widths and set up a pixel-based tween so we can do a 20% peek
                const viewportWidth = container.clientWidth;
                const totalWidth = track.scrollWidth;

                if (!viewportWidth || !totalWidth) return;

                const peek = viewportWidth * 0.2; // 20% of viewport

                const startX = -peek; // start with 20% of the previous image visible on the left
                const endX = -(totalWidth - viewportWidth) + peek; // finish with 20% of the next image visible on the right

                tween = gsap.fromTo(
                    track,
                    {
                        x: startX,
                        willChange: "transform",
                        force3D: true,
                    },
                    {
                        x: endX,
                        ease: "none",
                        paused: true,
                    }
                );

                const panel = container.closest("section") as HTMLElement | null;
                const rail = panel?.closest(".hs-rail") as HTMLElement | null;
                const parentST = ScrollTrigger.getById("hs-horizontal") as any;
                const containerAnimation = parentST?.animation;

                if (panel && rail && containerAnimation) {
                    // Synced to global horizontal rail
                    follower = ScrollTrigger.create({
                        id: `hs-horizontal-${panel.dataset?.key ?? ""}`,
                        trigger: panel,
                        containerAnimation,
                        start: "left right", // start as soon as it enters
                        end: "right left", // finish when it fully leaves
                        onUpdate: (self) => {
                            if (!ready || !tween) return;
                            tween.progress(self.progress);
                        },
                        invalidateOnRefresh: true,
                    });
                } else {
                    // Fallback: vertical scroll driving horizontal tween
                    follower = ScrollTrigger.create({
                        trigger: container,
                        scroller,
                        start: "top bottom", // immediately on entering viewport
                        end: "bottom top", // until it leaves
                        scrub: 0.8,
                        onUpdate: (self) => {
                            if (!ready || !tween) return;
                            tween.progress(self.progress);
                        },
                        invalidateOnRefresh: true,
                    });
                }
            };

            const buildVertical = () => {
                follower?.kill();
                follower = null;
                tween?.kill();
                tween = null;

                const distance = -100 * (len - 1);

                gsap.set(track, {
                    yPercent: 0,
                    willChange: "transform",
                    force3D: true,
                });

                tween = gsap.to(track, {
                    yPercent: distance,
                    ease: "none",
                    paused: true,
                });

                follower = ScrollTrigger.create({
                    trigger: container,
                    scroller,
                    start: "top bottom",
                    end: () => "+=" + window.innerHeight * Math.max(1, len - 1),
                    scrub: 0.7,
                    onUpdate: (self) => {
                        if (!ready || !tween) return;
                        tween.progress(self.progress);
                    },
                    invalidateOnRefresh: true,
                });
            };

            const buildAll = () => {
                if (direction === "vertical") buildVertical();
                else buildHorizontal();
            };

            buildAll();

            // Gate junk initial updates
            requestAnimationFrame(() => {
                ready = true;
                if (follower && tween) {
                    tween.progress(follower.progress);
                } else if (tween) {
                    tween.progress(0);
                }
            });

            const onRefreshInit = () => {
                ready = false;
                buildAll();
                requestAnimationFrame(() => {
                    ready = true;
                    if (follower && tween) tween.progress(follower.progress);
                });
            };

            ScrollTrigger.addEventListener("refreshInit", onRefreshInit);

            return () => {
                ScrollTrigger.removeEventListener("refreshInit", onRefreshInit);
                follower?.kill();
                tween?.kill();
            };
        }, container);

        return () => ctx.revert();
    }, [len, direction, renderLen]);

    if (len === 0) {
        return (
            <div
                className={clsx(
                    "relative w-full h-full grid place-items-center text-xs text-neutral-500",
                    className
                )}
            >
                No images
            </div>
        );
    }

    const sizesAttr =
        size === "half" ? "50vw" : size === "full" ? "100vw" : "100vw";

    const roleDesc =
        len > 0
            ? `${label}. ${len} frames. Scrolling reveals more frames.`
            : `${label}. No media.`;

    return (
        <div
            ref={containerRef}
            className={clsx(
                "relative w-full h-full overflow-hidden  will-change-transform",
                className
            )}
            style={{
                //contain: "layout paint style",
                containIntrinsicSize: "100vh 100vw",
            }}
            aria-label={roleDesc}
        >
            <div
                ref={trackRef}
                className={clsx(
                    "h-full w-full",
                    direction === "vertical" ? "flex flex-col" : "flex"
                )}
            >
                {renderImages.map((img, i) => (
                    <div
                        key={`${img.src}-${i}`}
                        className="relative h-full w-full flex-none"
                        style={{ contain: "paint" }}
                    >
                        <SmoothImage
                            src={img.src}
                            alt={img.alt}
                            fill
                            sizes={sizesAttr}
                            hiMaxWidth={size === "full" ? 2000 : 1400}
                            lqipWidth={24}
                            loading="lazy"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
