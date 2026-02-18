// src: components/ads/horizontal-image-slider.tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import clsx from "clsx";
import SmoothImage from "@/components/ui/smooth-image";
import type { AdvertImage } from "@/components/ads/advert";
import { predecodeNextImages } from "@/lib/predecode";
import { APP_EVENTS } from "@/lib/app-events";
import { getCurrentScrollY } from "@/lib/scroll-state";

gsap.registerPlugin(ScrollTrigger);

type Props = {
    images?: AdvertImage[] | null;
    className?: string;
    size?: "half" | "full" | "auto";
    label?: string;
    direction?: "horizontal" | "vertical";
    parallaxEnabled?: boolean;
    parallaxAmount?: "sm" | "md" | "lg";
    lockCrossAxisBleed?: boolean;
    objectFit?: "cover" | "contain";
};

function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}

export default function HorizontalImageSlider({
    images = [],
    className,
    size = "auto",
    label = "Advertisement",
    direction = "horizontal",
    parallaxEnabled = true,
    parallaxAmount = "md",
    lockCrossAxisBleed = false,
    objectFit = "cover",
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
                    width: i?.asset?.width ?? null,
                    height: i?.asset?.height ?? null,
                })),
        [images]
    );

    const len = prepared.length;
    const isSingle = len === 1;
    const allowParallax = parallaxEnabled !== false;
    const hasClones = allowParallax && direction !== "vertical" && len > 1;
    const parallaxScale = parallaxAmount === "sm" ? 0.6 : parallaxAmount === "lg" ? 1.4 : 1;

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

        const isRail = !!container.closest("[data-hs-rail]");
        const isHome = window.location.pathname === "/";
        const shouldHoldForHome = isHome && !(window as any).__homeHsRestored;

        // If this is a home-return restore, don't reveal until HOME_HS_RESTORED.
        // (This prevents a flash at the "start" transform and then a jump when scroll snaps back.)
        let allowReveal = !shouldHoldForHome;

        const hideContainer = () => {
            gsap.set(container, { opacity: 0, visibility: "hidden" });
        };

        const showContainer = () => {
            gsap.set(container, { opacity: 1, visibility: "visible" });
        };

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
                    clearProps: "position,left,right,top,bottom,width,height,scale,scaleX,scaleY,transformOrigin",
                    x: 0,
                    y: 0,
                    scale: 1,
                    willChange: "auto",
                    force3D: false,
                });
            }
            showContainer();
            return;
        }

        // Always start hidden; we'll reveal only after we've synced tween progress to the real scroll state.
        hideContainer();

        const scroller = window;

        const ctx = gsap.context(() => {
            let follower: ScrollTrigger | null = null;
            let tween: gsap.core.Tween | null = null;
            let ready = false;

            let syncRaf = 0;
            let initialSynced = false;

            let refreshTO: number | null = null;
            let stableRaf = 0;
            let stableStart = 0;
            let lastScrollY = 0;
            let stableFrames = 0;

            let fastSyncRaf = 0;

            const getContainerAnimation = () => {
                const parentST = ScrollTrigger.getById("hs-horizontal") as any;
                return parentST?.animation;
            };

            const revealContainer = () => {
                if (!allowReveal) return;
                showContainer();
            };

            const applyProgress = (p: number) => {
                if (!ready || !tween) return;
                tween.progress(p);
            };

            const buildFollowerFromRail = (
                progressCb: (p: number) => void,
                triggerEl: HTMLElement,
                requireContainerAnimation: boolean
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

                // If we're inside the HS rail, don't fall back: it gives the wrong progress
                // during home-return restoration and causes a visible jump.
                if (requireContainerAnimation) return null;

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

            const syncToProgress = (force = false) => {
                // Never reveal until we actually have a tween AND can compute a real progress.
                if (!tween || !follower) return;

                // If we're on the HS rail, require containerAnimation to exist.
                if (isRail && !getContainerAnimation()) return;

                if (force) {
                    try {
                        ScrollTrigger.update();
                    } catch {
                        // ignore
                    }
                }

                const p = follower.progress;
                tween.progress(p);
                ready = true;
                revealContainer();
            };

            const queueSync = (force = false) => {
                if (syncRaf) cancelAnimationFrame(syncRaf);
                syncRaf = requestAnimationFrame(() => {
                    syncRaf = 0;
                    syncToProgress(force);
                });
            };

            const finalizeInitialSync = () => {
                if (initialSynced) return;
                initialSynced = true;

                if (refreshTO) {
                    window.clearTimeout(refreshTO);
                    refreshTO = null;
                }

                // Force one update pass; then sync & reveal (only if allowReveal is true).
                syncToProgress(true);
            };

            const startInitialSync = () => {
                if (initialSynced) {
                    queueSync(true);
                    return;
                }

                // Fast path (non-home restore): next frame is enough.
                if (!shouldHoldForHome && !isRail) {
                    if (fastSyncRaf) cancelAnimationFrame(fastSyncRaf);
                    fastSyncRaf = requestAnimationFrame(() => {
                        fastSyncRaf = 0;
                        try {
                            ScrollTrigger.refresh();
                        } catch {
                            // ignore
                        }
                        finalizeInitialSync();
                    });
                    return;
                }

                // Home restore / rail: wait for scroll to settle, then refresh and sync.
                if (stableRaf) return;

                stableStart = performance.now();
                lastScrollY = getCurrentScrollY();
                stableFrames = 0;

                const tick = () => {
                    const now = performance.now();
                    const nextY = getCurrentScrollY();
                    const delta = Math.abs(nextY - lastScrollY);
                    lastScrollY = nextY;

                    if (delta < 0.5) stableFrames += 1;
                    else stableFrames = 0;

                    const timedOut = now - stableStart > 600;

                    if (stableFrames >= 2 || timedOut) {
                        stableRaf = 0;

                        if (refreshTO) window.clearTimeout(refreshTO);
                        refreshTO = window.setTimeout(() => finalizeInitialSync(), 220);

                        try {
                            ScrollTrigger.refresh();
                        } catch {
                            // ignore
                        }

                        return;
                    }

                    stableRaf = requestAnimationFrame(tick);
                };

                stableRaf = requestAnimationFrame(tick);
            };

            const buildHorizontal = () => {
                follower?.kill();
                follower = null;
                tween?.kill();
                tween = null;
                ready = false;

                // Always hide during rebuild; we'll re-reveal after sync.
                hideContainer();

                const viewportW = container.clientWidth;
                if (!viewportW) return;

                const requireCA = isRail;

                // SINGLE IMAGE: original move + cross-axis bleed to preserve full-height framing.
                if (isSingle) {
                    const target = singlePanRef.current;
                    if (!target) return;

                    const viewportH = Math.max(1, container.clientHeight);
                    const single = prepared[0];
                    const imageAspect =
                        typeof single?.width === "number" &&
                        single.width > 0 &&
                        typeof single?.height === "number" &&
                        single.height > 0
                            ? single.width / single.height
                            : viewportW / viewportH;
                    const pan = clamp(clamp(viewportW * 0.08, 16, 140) * parallaxScale, 8, 180);
                    const baseYBleed = Math.max(0, Math.ceil(((viewportW + pan * 2) / Math.max(imageAspect, 0.0001) - viewportH) / 2));
                    const yBleed = lockCrossAxisBleed ? 0 : baseYBleed;

                    gsap.set(target, {
                        position: "absolute",
                        left: -pan,
                        top: -yBleed,
                        width: `calc(100% + ${pan * 2}px)`,
                        height: `calc(100% + ${yBleed * 2}px)`,
                        x: 0,
                        y: 0,
                        scale: 1,
                        scaleX: 1,
                        scaleY: 1,
                        transformOrigin: "center",
                        willChange: "transform",
                        force3D: true,
                    });

                    tween = gsap.fromTo(target, { x: -pan }, { x: pan, ease: "none", paused: true });

                    const panel = container.closest("section") as HTMLElement | null;
                    const triggerEl = panel ?? container;

                    follower = buildFollowerFromRail((p) => applyProgress(p), triggerEl, requireCA);

                    return;
                }

                // MULTI IMAGE: track scroll with a peek at both ends
                const totalW = track.scrollWidth;
                if (!totalW) return;

                const frameW = totalW / Math.max(1, renderLen);
                const basePeek = clamp(frameW * 0.2, 18, frameW * 0.35);
                const peek = clamp(basePeek * parallaxScale, 12, frameW * 0.45);

                const startX = hasClones ? -(frameW - peek) : -peek;

                const endX = hasClones ? -(frameW * len + peek) : -(totalW - viewportW) + peek;

                tween = gsap.fromTo(
                    track,
                    { x: startX, willChange: "transform", force3D: true },
                    { x: endX, ease: "none", paused: true }
                );

                const panel = container.closest("section") as HTMLElement | null;
                const triggerEl = panel ?? container;

                follower = buildFollowerFromRail((p) => applyProgress(p), triggerEl, requireCA);
            };

            const buildVertical = () => {
                follower?.kill();
                follower = null;
                tween?.kill();
                tween = null;
                ready = false;

                hideContainer();

                const viewportH = container.clientHeight;
                if (!viewportH) return;

                const requireCA = isRail;

                if (isSingle) {
                    const target = singlePanRef.current;
                    if (!target) return;

                    const viewportW = Math.max(1, container.clientWidth);
                    const single = prepared[0];
                    const imageAspect =
                        typeof single?.width === "number" &&
                        single.width > 0 &&
                        typeof single?.height === "number" &&
                        single.height > 0
                            ? single.width / single.height
                            : viewportW / viewportH;
                    const pan = clamp(clamp(viewportH * 0.08, 16, 140) * parallaxScale, 8, 180);
                    const baseXBleed = Math.max(0, Math.ceil((imageAspect * (viewportH + pan * 2) - viewportW) / 2));
                    const xBleed = lockCrossAxisBleed ? 0 : baseXBleed;

                    gsap.set(target, {
                        position: "absolute",
                        left: -xBleed,
                        top: -pan,
                        width: `calc(100% + ${xBleed * 2}px)`,
                        height: `calc(100% + ${pan * 2}px)`,
                        x: 0,
                        y: 0,
                        scale: 1,
                        scaleX: 1,
                        scaleY: 1,
                        transformOrigin: "center",
                        willChange: "transform",
                        force3D: true,
                    });

                    tween = gsap.fromTo(target, { y: -pan }, { y: pan, ease: "none", paused: true });

                    const panel = container.closest("section") as HTMLElement | null;
                    const triggerEl = panel ?? container;

                    follower = buildFollowerFromRail((p) => applyProgress(p), triggerEl, requireCA);

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
                    onUpdate: (self) => applyProgress(self.progress),
                    invalidateOnRefresh: true,
                });
            };

            const buildAll = () => {
                if (direction === "vertical") buildVertical();
                else buildHorizontal();
            };

            buildAll();

            // Only try to sync/reveal when we're allowed to reveal.
            if (allowReveal) startInitialSync();

            const onRefreshInit = () => {
                ready = false;
                buildAll();
            };

            const onRefresh = () => {
                if (!allowReveal) return;
                if (!initialSynced) {
                    finalizeInitialSync();
                    return;
                }
                syncToProgress(true);
            };

            const onHsReady = () => {
                buildAll();
                if (allowReveal) startInitialSync();
            };

            const onHomeRestored = () => {
                allowReveal = true;
                buildAll();
                startInitialSync();
            };

            ScrollTrigger.addEventListener("refreshInit", onRefreshInit);
            ScrollTrigger.addEventListener("refresh", onRefresh);

            if (isRail) {
                window.addEventListener("hs-ready", onHsReady);
                window.addEventListener("hs-rebuilt", onHsReady);
            }

            if (shouldHoldForHome) {
                window.addEventListener(APP_EVENTS.HOME_HS_RESTORED, onHomeRestored, { once: true });
            }

            return () => {
                ScrollTrigger.removeEventListener("refreshInit", onRefreshInit);
                ScrollTrigger.removeEventListener("refresh", onRefresh);

                if (isRail) {
                    window.removeEventListener("hs-ready", onHsReady);
                    window.removeEventListener("hs-rebuilt", onHsReady);
                }

                if (shouldHoldForHome) {
                    window.removeEventListener(APP_EVENTS.HOME_HS_RESTORED, onHomeRestored as any);
                }

                if (syncRaf) cancelAnimationFrame(syncRaf);
                if (stableRaf) cancelAnimationFrame(stableRaf);
                if (fastSyncRaf) cancelAnimationFrame(fastSyncRaf);
                if (refreshTO) window.clearTimeout(refreshTO);

                follower?.kill();
                tween?.kill();
            };
        }, container);

        return () => ctx.revert();
    }, [len, direction, renderLen, hasClones, isSingle, allowParallax, parallaxScale]);

    if (len === 0) {
        return (
            <div className={clsx("relative w-full h-full grid place-items-center text-xs text-neutral-500", className)}>
                No images
            </div>
        );
    }

    const sizesAttr = size === "half" ? "50vw" : size === "full" ? "100vw" : "100vw";
    const hiMaxWidth = size === "full" ? 3200 : 2600;

    const roleDesc =
        len > 0 ? `${label}. ${len} frames. Scrolling reveals more frames.` : `${label}. No media.`;

    return (
        <div
            ref={containerRef}
            className={clsx("relative w-full h-full overflow-hidden will-change-transform", className)}
            style={{
                containIntrinsicSize: "760px 100vw",
                opacity: allowParallax ? 0 : 1,
                visibility: allowParallax ? ("hidden" as any) : ("visible" as any),
            }}
            aria-label={roleDesc}
        >
            <div ref={trackRef} className={clsx("h-full w-full", direction === "vertical" ? "flex flex-col" : "flex")}>
                {renderImages.map((img, i) => {
                    const isOnly = isSingle && i === 0;

                    return (
                        <div
                            key={`${img.src}-${i}`}
                            className="relative h-full w-full flex-none overflow-hidden"
                            style={{ contain: "paint" }}
                        >
                            <div ref={isOnly ? singlePanRef : undefined} className="relative h-full w-full will-change-transform">
                                <SmoothImage
                                    src={img.src}
                                    alt={img.alt}
                                    fill
                                    sizes={sizesAttr}
                                    hiMaxWidth={hiMaxWidth}
                                    hiQuality={90}
                                    lqipWidth={24}
                                    loading="lazy"
                                    objectFit={objectFit}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
