// components/ads/horizontal-image-slider.tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
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
    parallaxEnabled?: boolean;
    parallaxAmount?: "sm" | "md" | "lg";
};

function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}

// Ensure the scaled content always covers the container while panning +/- pan.
// Required scale ~= 1 + (2*pan)/viewport. Add a tiny overscan to avoid subpixel gaps.
function coverScale(viewportPx: number, panPx: number) {
    const v = Math.max(1, viewportPx);
    const required = 1 + (2 * panPx) / v;
    return clamp(required + 0.02, 1.02, 1.6);
}

export default function HorizontalImageSlider({
    images = [],
    className,
    size = "auto",
    label = "Advertisement",
    direction = "horizontal",
    parallaxEnabled = true,
    parallaxAmount = "md",
}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const singlePanRef = useRef<HTMLDivElement | null>(null);

    // stable per-instance id to avoid ScrollTrigger id collisions
    const stIdRef = useRef(`ad-hs-${Math.random().toString(36).slice(2)}`);

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
    const isSingle = len === 1;
    const allowParallax = parallaxEnabled !== false;
    const hasClones = allowParallax && direction !== "vertical" && len > 1;
    const parallaxScale =
        parallaxAmount === "sm" ? 0.6 : parallaxAmount === "lg" ? 1.4 : 1;

    // For horizontal, extend with clones so we can show prev/next peeks at extremes.
    const renderImages = useMemo(() => {
        if (!hasClones) return prepared;
        const first = prepared[0];
        const last = prepared[prepared.length - 1];
        return [last, ...prepared, first];
    }, [prepared, hasClones]);

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
            { root: null, rootMargin: "50% 0px", threshold: 0 }
        );

        observer.observe(rootEl);
        return () => observer.disconnect();
    }, [len]);

    useLayoutEffect(() => {
        if (!len) return;
        if (typeof window === "undefined") return;

        const container = containerRef.current;
        const track = trackRef.current;
        if (!container || !track) return;

        if (!allowParallax || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            const target = singlePanRef.current;
            gsap.set(track, {
                x: 0,
                y: 0,
                xPercent: 0,
                yPercent: 0,
                willChange: "auto",
                force3D: false,
            });
            if (target) {
                gsap.set(target, {
                    x: 0,
                    y: 0,
                    scale: 1,
                    willChange: "auto",
                    force3D: false,
                });
            }
            return;
        }

        const scroller = window;

        const ctx = gsap.context(() => {
            let follower: ScrollTrigger | null = null;
            let tween: gsap.core.Tween | null = null;
            let ready = false;

            const getContainerAnimation = () => {
                const parentST = ScrollTrigger.getById("hs-horizontal") as any;
                return parentST?.animation;
            };

            const buildFollowerFromRail = (
                progressCb: (p: number) => void,
                triggerEl: HTMLElement
            ) => {
                const containerAnimation = getContainerAnimation();

                if (containerAnimation) {
                    return ScrollTrigger.create({
                        id: `${stIdRef.current}-rail`,
                        trigger: triggerEl,
                        containerAnimation,
                        start: "left right",
                        end: "right left",
                        onUpdate: (self) => progressCb(self.progress),
                        invalidateOnRefresh: true,
                    });
                }

                return ScrollTrigger.create({
                    id: `${stIdRef.current}-fallback`,
                    trigger: container,
                    scroller,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 0.8,
                    onUpdate: (self) => progressCb(self.progress),
                    invalidateOnRefresh: true,
                });
            };

            const buildHorizontal = () => {
                follower?.kill();
                follower = null;
                tween?.kill();
                tween = null;

                const viewportW = container.clientWidth;
                if (!viewportW) return;

                // SINGLE IMAGE: internal pan (no gaps — scale is derived from pan)
                if (isSingle) {
                    const target = singlePanRef.current;
                    if (!target) return;

                    const basePan = clamp(viewportW * 0.08, 16, 140);
                    const pan = clamp(basePan * parallaxScale, 8, 180);
                    const scale = coverScale(viewportW, pan);

                    gsap.set(target, {
                        x: 0,
                        y: 0,
                        scale,
                        transformOrigin: "center",
                        willChange: "transform",
                        force3D: true,
                    });

                    tween = gsap.fromTo(
                        target,
                        { x: -pan },
                        { x: pan, ease: "none", paused: true }
                    );

                    const panel = container.closest("section") as HTMLElement | null;
                    const triggerEl = panel ?? container;

                    follower = buildFollowerFromRail((p) => {
                        if (!ready || !tween) return;
                        tween.progress(p);
                    }, triggerEl);

                    return;
                }

                // MULTI IMAGE: track scroll with a peek at both ends
                const totalW = track.scrollWidth;
                if (!totalW) return;

                const frameW = totalW / Math.max(1, renderLen);
                const basePeek = clamp(frameW * 0.2, 18, frameW * 0.35);
                const peek = clamp(basePeek * parallaxScale, 12, frameW * 0.45);

                const startX = hasClones
                    ? -(frameW - peek) // start on first REAL frame with left peek of the prev (clone)
                    : -peek;

                const endX = hasClones
                    ? -(frameW * len + peek) // end on last REAL frame with right peek of the next (clone)
                    : -(totalW - viewportW) + peek;

                tween = gsap.fromTo(
                    track,
                    { x: startX, willChange: "transform", force3D: true },
                    { x: endX, ease: "none", paused: true }
                );

                const panel = container.closest("section") as HTMLElement | null;
                const triggerEl = panel ?? container;

                follower = buildFollowerFromRail((p) => {
                    if (!ready || !tween) return;
                    tween.progress(p);
                }, triggerEl);
            };

            const buildVertical = () => {
                follower?.kill();
                follower = null;
                tween?.kill();
                tween = null;

                const viewportH = container.clientHeight;
                if (!viewportH) return;

                if (isSingle) {
                    const target = singlePanRef.current;
                    if (!target) return;

                    const basePan = clamp(viewportH * 0.08, 16, 140);
                    const pan = clamp(basePan * parallaxScale, 8, 180);
                    const scale = coverScale(viewportH, pan);

                    gsap.set(target, {
                        x: 0,
                        y: 0,
                        scale,
                        transformOrigin: "center",
                        willChange: "transform",
                        force3D: true,
                    });

                    tween = gsap.fromTo(
                        target,
                        { y: -pan },
                        { y: pan, ease: "none", paused: true }
                    );

                    follower = ScrollTrigger.create({
                        id: `${stIdRef.current}-v-fallback`,
                        trigger: container,
                        scroller,
                        start: "top bottom",
                        end: "bottom top",
                        scrub: 0.8,
                        onUpdate: (self) => {
                            if (!ready || !tween) return;
                            tween.progress(self.progress);
                        },
                        invalidateOnRefresh: true,
                    });

                    return;
                }

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
                    id: `${stIdRef.current}-v`,
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

            requestAnimationFrame(() => {
                ready = true;
                if (follower && tween) tween.progress(follower.progress);
                else if (tween) tween.progress(0);
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
    }, [len, direction, renderLen, hasClones, isSingle, allowParallax, parallaxScale]);

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

    const sizesAttr = size === "half" ? "50vw" : size === "full" ? "100vw" : "100vw";

    const roleDesc =
        len > 0 ? `${label}. ${len} frames. Scrolling reveals more frames.` : `${label}. No media.`;

    return (
        <div
            ref={containerRef}
            className={clsx("relative w-full h-full overflow-hidden will-change-transform", className)}
            style={{ containIntrinsicSize: "100vh 100vw" }}
            aria-label={roleDesc}
        >
            <div
                ref={trackRef}
                className={clsx("h-full w-full", direction === "vertical" ? "flex flex-col" : "flex")}
            >
                {renderImages.map((img, i) => {
                    const isOnly = isSingle && i === 0;

                    return (
                        <div
                            key={`${img.src}-${i}`}
                            className="relative h-full w-full flex-none overflow-hidden"
                            style={{ contain: "paint" }}
                        >
                            <div
                                ref={isOnly ? singlePanRef : undefined}
                                className="relative h-full w-full will-change-transform"
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
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
