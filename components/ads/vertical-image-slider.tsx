// components/ads/vertical-image-slider.tsx
"use client";

import { useLayoutEffect, useMemo, useRef, useEffect } from "react";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import ScrollSmoother from "gsap/ScrollSmoother";
import clsx from "clsx";
import SmoothImage from "@/components/ui/smooth-image";
import type { AdvertImage } from "@/components/ads/advert";
import { predecodeNextImages } from "@/lib/predecode";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

type Props = {
    images?: AdvertImage[] | null;
    className?: string;
    size?: "half" | "full" | "auto";
    label?: string;
};

export default function VerticalImageSlider({
    images = [],
    className,
    size = "auto",
    label = "Advertisement",
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

    // Add clones at both ends so we can show a peek of prev/next at extremes
    const renderImages = useMemo(() => {
        if (prepared.length <= 1) return prepared;
        const first = prepared[0];
        const last = prepared[prepared.length - 1];
        return [last, ...prepared, first];
    }, [prepared]);

    const renderLen = renderImages.length;

    // Pre-decode images when this block approaches the viewport
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

        const scroller = ScrollSmoother.get()?.content() || window;

        const ctx = gsap.context(() => {
            let follower: ScrollTrigger | null = null;
            let tween: gsap.core.Tween | null = null;
            let ready = false;

            const buildFollower = () => {
                follower?.kill();
                follower = null;
                tween?.kill();
                tween = null;

                const containerHeight = container.clientHeight;
                const totalHeight = track.scrollHeight;

                // If everything fits, don't bother animating
                if (!containerHeight || !totalHeight || totalHeight <= containerHeight) {
                    gsap.set(track, {
                        y: 0,
                        willChange: "auto",
                        force3D: false,
                    });
                    return;
                }

                const peek = containerHeight * 0.2; // 20% of viewport height

                const startY = -peek; // start with 20% of previous image visible above
                const endY = -(totalHeight - containerHeight) + peek; // finish with 20% of next image visible below

                tween = gsap.fromTo(
                    track,
                    {
                        y: startY,
                        willChange: "transform",
                        force3D: true,
                    },
                    {
                        y: endY,
                        ease: "none",
                        paused: true,
                    }
                );

                const panel = container.closest("section") as HTMLElement | null;
                const rail = panel?.closest(".hs-rail") as HTMLElement | null;
                const parentST = ScrollTrigger.getById("hs-horizontal") as any;
                const containerAnimation = parentST?.animation;

                if (panel && rail && containerAnimation) {
                    // driven by horizontal rail
                    follower = ScrollTrigger.create({
                        trigger: panel,
                        containerAnimation,
                        start: "left right", // start as soon as section enters rail
                        end: "right left", // finish when it leaves
                        onUpdate: (self) => {
                            if (!ready || !tween) return;
                            tween.progress(self.progress);
                        },
                        invalidateOnRefresh: true,
                    });
                } else {
                    // fallback – vertical scroll controlling vertical tween
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

            buildFollower();

            // gate initial junk updates and sync once
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
                buildFollower();
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
    }, [len, renderLen]);

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
                containIntrinsicSize: "100vh 50vw",
            }}
            aria-label={roleDesc}
        >
            <div ref={trackRef} className="flex h-full w-full flex-col">
                {renderImages.map((img, i) => (
                    <div
                        key={`${img.src}-${i}`}
                        className="relative h-full w-full shrink-0"
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
