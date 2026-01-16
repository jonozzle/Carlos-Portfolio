// components/ads/vertical-image-slider.tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
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
    parallaxEnabled?: boolean;
    parallaxAmount?: "sm" | "md" | "lg";
};

function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}

// Ensure the scaled content always covers the container while panning +/- pan.
function coverScale(viewportPx: number, panPx: number) {
    const v = Math.max(1, viewportPx);
    const required = 1 + (2 * panPx) / v;
    return clamp(required + 0.02, 1.02, 1.6);
}

export default function VerticalImageSlider({
    images = [],
    className,
    size = "auto",
    label = "Advertisement",
    parallaxEnabled = true,
    parallaxAmount = "md",
}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const singlePanRef = useRef<HTMLDivElement | null>(null);

    const stIdRef = useRef(`ad-vs-${Math.random().toString(36).slice(2)}`);

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
    const parallaxScale =
        parallaxAmount === "sm" ? 0.6 : parallaxAmount === "lg" ? 1.4 : 1;

    // Add clones at both ends so we can show a peek of prev/next at extremes
    const renderImages = useMemo(() => {
        if (!allowParallax || prepared.length <= 1) return prepared;
        const first = prepared[0];
        const last = prepared[prepared.length - 1];
        return [last, ...prepared, first];
    }, [prepared, allowParallax]);

    const renderLen = renderImages.length;
    const hasClones = allowParallax && len > 1;

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

        const scroller = ScrollSmoother.get()?.content() || window;

        const ctx = gsap.context(() => {
            let follower: ScrollTrigger | null = null;
            let tween: gsap.core.Tween | null = null;
            let ready = false;

            const getContainerAnimation = () => {
                const parentST = ScrollTrigger.getById("hs-horizontal") as any;
                return parentST?.animation;
            };

            const buildFollowerFromRail = (progressCb: (p: number) => void, triggerEl: HTMLElement) => {
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

            const buildFollower = () => {
                follower?.kill();
                follower = null;
                tween?.kill();
                tween = null;

                const viewportH = container.clientHeight;
                if (!viewportH) return;

                // SINGLE IMAGE: subtle internal pan with scale derived from pan (no edge gaps)
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

                    const panel = container.closest("section") as HTMLElement | null;
                    const triggerEl = panel ?? container;

                    follower = buildFollowerFromRail((p) => {
                        if (!ready || !tween) return;
                        tween.progress(p);
                    }, triggerEl);

                    return;
                }

                // MULTI IMAGE: track scroll with correct clone-aware peeks
                const totalH = track.scrollHeight;
                if (!totalH) return;

                if (totalH <= viewportH) {
                    gsap.set(track, { y: 0, willChange: "auto", force3D: false });
                    return;
                }

                const frameH = totalH / Math.max(1, renderLen);
                const basePeek = clamp(frameH * 0.2, 18, frameH * 0.35);
                const peek = clamp(basePeek * parallaxScale, 12, frameH * 0.45);

                const startY = hasClones
                    ? -(frameH - peek) // start on first REAL frame with top peek of prev (clone)
                    : -peek;

                const endY = hasClones
                    ? -(frameH * len + peek) // end on last REAL frame with bottom peek of next (clone)
                    : -(totalH - viewportH) + peek;

                tween = gsap.fromTo(
                    track,
                    { y: startY, willChange: "transform", force3D: true },
                    { y: endY, ease: "none", paused: true }
                );

                const panel = container.closest("section") as HTMLElement | null;
                const triggerEl = panel ?? container;

                follower = buildFollowerFromRail((p) => {
                    if (!ready || !tween) return;
                    tween.progress(p);
                }, triggerEl);
            };

            buildFollower();

            requestAnimationFrame(() => {
                ready = true;
                if (follower && tween) tween.progress(follower.progress);
                else if (tween) tween.progress(0);
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
    }, [len, renderLen, hasClones, isSingle, allowParallax, parallaxScale]);

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
            style={{ containIntrinsicSize: "100vh 50vw" }}
            aria-label={roleDesc}
        >
            <div ref={trackRef} className="flex h-full w-full flex-col">
                {renderImages.map((img, i) => {
                    const isOnly = isSingle && i === 0;

                    return (
                        <div
                            key={`${img.src}-${i}`}
                            className="relative h-full w-full shrink-0 overflow-hidden"
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
