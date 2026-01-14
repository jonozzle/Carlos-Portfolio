// ProjectBlock
// components/project/project-block.tsx
"use client";

import React, {
    useCallback,
    useMemo,
    useRef,
    useState,
    useEffect,
    useLayoutEffect,
} from "react";
import SmoothImage from "@/components/ui/smooth-image";
import { useTheme, type ThemeInput } from "@/components/theme-provider";
import PageTransitionButton from "@/components/page-transition-button";
import { completeHeroTransition } from "@/lib/hero-transition";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { APP_EVENTS } from "@/lib/app-events";
import { HOVER_EVENTS, isHoverLocked, getLastMouse } from "@/lib/hover-lock";
import SectionScrollLine from "@/components/ui/section-scroll-line";
import { getCurrentScrollY, setCurrentScrollY } from "@/lib/scroll-state";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

type Theme = ThemeInput | null;

type MobileLayout = "below-left" | "below-right" | "left" | "right";

type SingleGalleryItem = {
    slug?: string | null;
    title?: string | null;
    client?: string | null;
    year?: number | null;
    theme?: Theme;
    image?: {
        asset?: { url?: string | null } | null;
        alt?: string | null;
    } | null;
};

type ThemeContext = ReturnType<typeof useTheme>;

type Slot = {
    img: { col: string; row: string };
    info: { col: string; row: string; align?: "left" | "right" };
};

type ProjectLayoutEntry = {
    project: SingleGalleryItem;
    mobileLayout: MobileLayout;
    imageRowStart: number;
    imageRowEnd: number;
    imageColStart: number;
    imageColEnd: number;
    infoRowStart: number;
    infoRowEnd: number;
    infoColStart: number;
    infoColEnd: number;
};

type Props = {
    _type: "project-block";
    _key: string;
    title?: string | null;
    width?: string | null;
    projects?: {
        project?: SingleGalleryItem | null;

        // MOBILE
        mobileLayout?: MobileLayout | null;

        // DESKTOP GRID
        imageRowStart?: number | null;
        imageRowEnd?: number | null;
        imageColStart?: number | null;
        imageColEnd?: number | null;
        infoRowStart?: number | null;
        infoRowEnd?: number | null;
        infoColStart?: number | null;
        infoColEnd?: number | null;
    }[] | null;
};

type CellProps = {
    item: SingleGalleryItem;
    slot: Slot;
    mobileLayout: MobileLayout;
    themeCtx: ThemeContext;
    index: number;
    activeIndex: number | null;
    setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>;
    isScrollingRef: React.MutableRefObject<boolean>;
};

function cx(...parts: Array<string | null | undefined | false>) {
    return parts.filter(Boolean).join(" ");
}

function normalizeMobileLayout(v: unknown): MobileLayout {
    if (v === "below-left" || v === "below-right" || v === "left" || v === "right") return v;
    return "below-left";
}

function isMobileNow() {
    try {
        return window.matchMedia("(max-width: 767px)").matches;
    } catch {
        return false;
    }
}

function isAppScrolling() {
    if (typeof window === "undefined") return false;
    return !!(window as any).__appScrolling;
}

const ProjectBlockCell = React.memo(function ProjectBlockCell({
    item,
    slot,
    mobileLayout,
    themeCtx,
    index,
    activeIndex,
    setActiveIndex,
    isScrollingRef,
}: CellProps) {
    const tileRef = useRef<HTMLDivElement | null>(null);
    const imgScaleRef = useRef<HTMLDivElement | null>(null);
    const navLockedRef = useRef(false);

    const slug = item?.slug ?? "";
    const href = slug ? `/projects/${slug}` : "#";
    const imgUrl = item?.image?.asset?.url || "";
    const alt = item?.image?.alt ?? item?.title ?? "Project image";
    const theme = item?.theme ?? null;
    const hasTheme = !!(theme && ((theme as any).bg || (theme as any).text));

    const { previewTheme, clearPreview, lockTheme } = themeCtx;

    const isActive = activeIndex === index;
    const dimState: "active" | "inactive" = isActive ? "active" : "inactive";

    const [isMobile, setIsMobile] = useState(false);
    const [imgMeta, setImgMeta] = useState<{
        w: number;
        h: number;
        ratio: number;
        isPortrait: boolean;
    } | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const mq = window.matchMedia("(max-width: 767px)");
        const update = () => setIsMobile(mq.matches);
        update();

        // Safari < 14 fallback not needed for modern targets, but keep safe:
        try {
            mq.addEventListener("change", update);
            return () => mq.removeEventListener("change", update);
        } catch {
            mq.addListener(update);
            return () => mq.removeListener(update);
        }
    }, []);

    useEffect(() => {
        if (!imgUrl) {
            setImgMeta(null);
            return;
        }

        let cancelled = false;
        const im = new Image();
        im.decoding = "async";
        im.src = imgUrl;

        im.onload = () => {
            if (cancelled) return;
            const w = im.naturalWidth || 1;
            const h = im.naturalHeight || 1;
            setImgMeta({
                w,
                h,
                ratio: w / h,
                isPortrait: h > w,
            });
        };

        im.onerror = () => {
            if (cancelled) return;
            setImgMeta(null);
        };

        return () => {
            cancelled = true;
        };
    }, [imgUrl]);

    const animateScale = useCallback((to: number) => {
        const el = imgScaleRef.current;
        if (!el) return;
        gsap.killTweensOf(el);
        gsap.to(el, {
            scale: to,
            duration: 0.55,
            ease: "power3.out",
            overwrite: true,
        });
    }, []);

    const hardResetScale = useCallback(() => {
        const el = imgScaleRef.current;
        if (!el) return;
        gsap.killTweensOf(el);
        gsap.set(el, { scale: 1 });
    }, []);

    const clearHover = useCallback((forceAnim?: boolean) => {
        if (navLockedRef.current) return;
        if (hasTheme) {
            const opts = forceAnim ? { animate: true, force: true } : undefined;
            clearPreview(opts);
        }
        setActiveIndex((prev) => (prev === index ? null : prev));
        animateScale(1);
    }, [hasTheme, clearPreview, setActiveIndex, index, animateScale]);

    const applyHover = useCallback((allowIdle?: boolean, skipScale?: boolean) => {
        if (navLockedRef.current) return;
        if (isScrollingRef.current) return;
        if (isHoverLocked()) return;
        const forceAnim = isAppScrolling();
        const opts = allowIdle || forceAnim ? { allowIdle: !!allowIdle, force: forceAnim } : undefined;
        if (hasTheme) previewTheme(theme, opts);
        setActiveIndex(index);
        if (!skipScale) animateScale(1.1);
    }, [hasTheme, previewTheme, theme, setActiveIndex, index, isScrollingRef, animateScale]);

    const handleEnter = useCallback(() => {
        applyHover();
    }, [applyHover]);

    const isPointerInside = useCallback(() => {
        const el = tileRef.current;
        if (!el) return false;

        const pos = getLastMouse();
        if (pos) {
            const hit = document.elementFromPoint(pos.x, pos.y);
            return !!(hit && el.contains(hit));
        }

        return el.matches(":hover");
    }, []);

    const handleLeave = useCallback(() => {
        if (navLockedRef.current) return;
        if (isHoverLocked()) return;
        const appScrolling = isAppScrolling();
        if ((appScrolling || isScrollingRef.current) && isPointerInside()) return;
        clearHover(appScrolling);
    }, [clearHover, isScrollingRef, isPointerInside]);

    const applyHoverUnderPointer = useCallback(
        (allowIdle?: boolean) => {
            const el = tileRef.current;
            if (!el) return;

            if (isPointerInside()) {
                const scaleEl = imgScaleRef.current;
                const scaleNow = scaleEl ? gsap.getProperty(scaleEl, "scale") : 1;
                const scaleNum =
                    typeof scaleNow === "number"
                        ? scaleNow
                        : Number.parseFloat(String(scaleNow));
                const isScaled = Number.isFinite(scaleNum) ? scaleNum > 1.02 : false;

                if (!isScaled) hardResetScale();
                requestAnimationFrame(() => applyHover(allowIdle, isScaled));
            }
        },
        [applyHover, hardResetScale, isPointerInside]
    );

    const handleNavLockCapture = useCallback(() => {
        if (!slug) return;

        navLockedRef.current = true;

        if (hasTheme) {
            lockTheme(theme, { animate: false, force: true, durationMs: 0 });
        }

        const el = imgScaleRef.current;
        if (el) gsap.killTweensOf(el);
    }, [slug, hasTheme, lockTheme, theme]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const onUnlocked = () => {
            if (isAppScrolling()) return;
            applyHoverUnderPointer(true);
        };

        window.addEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked);
        return () => window.removeEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked as any);
    }, [applyHoverUnderPointer]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const onScrollEnd = () => {
            applyHoverUnderPointer(true);
        };

        window.addEventListener(APP_EVENTS.SCROLL_END, onScrollEnd);
        return () => window.removeEventListener(APP_EVENTS.SCROLL_END, onScrollEnd as any);
    }, [applyHoverUnderPointer]);

    // Project -> Home: overlay targets this tile
    useLayoutEffect(() => {
        if (typeof window === "undefined") return;
        if (!slug) return;
        if (!tileRef.current) return;

        const pending = (window as any).__heroPending as { slug?: string } | undefined;
        const match = !!pending && pending.slug === slug;
        if (!match) return;

        hardResetScale();

        let raf = 0;
        let frames = 0;
        let ran = false;

        let lastRect: { left: number; top: number; width: number; height: number } | null = null;
        let stableCount = 0;

        const EPS = 0.75;
        const STABLE_FRAMES = 4;
        const MAX_FRAMES = 360;

        let nudged = false;

        const rectDelta = (
            a: { left: number; top: number; width: number; height: number },
            b: { left: number; top: number; width: number; height: number }
        ) =>
            Math.abs(a.left - b.left) +
            Math.abs(a.top - b.top) +
            Math.abs(a.width - b.width) +
            Math.abs(a.height - b.height);

        const rectOk = (r: DOMRect) =>
            Number.isFinite(r.left) &&
            Number.isFinite(r.top) &&
            Number.isFinite(r.width) &&
            Number.isFinite(r.height) &&
            r.width > 2 &&
            r.height > 2;

        const isTargetInViewport = (el: HTMLElement) => {
            const r = el.getBoundingClientRect();
            if (!rectOk(r)) return false;

            const vw = window.innerWidth || 1;
            const vh = window.innerHeight || 1;

            const slackX = vw * 0.25;
            const slackY = vh * 0.25;

            return r.right > -slackX && r.left < vw + slackX && r.bottom > -slackY && r.top < vh + slackY;
        };

        const nudgeIntoView = (el: HTMLElement) => {
            if (nudged) return;
            nudged = true;

            const r = el.getBoundingClientRect();
            const vh = window.innerHeight || 1;

            // center tile in viewport
            const targetY = getCurrentScrollY() + r.top - (vh / 2 - r.height / 2);
            setCurrentScrollY(targetY);

            // after we move scroll, we must re-stabilize rect
            lastRect = null;
            stableCount = 0;
        };

        const run = () => {
            if (ran) return;
            ran = true;

            const el = tileRef.current;
            if (!el) return;

            completeHeroTransition({
                slug,
                targetEl: el,
                mode: "parkThenPage",
            });
        };

        const tick = () => {
            frames += 1;

            try {
                ScrollTrigger.update();
            } catch {
                // ignore
            }

            const el = tileRef.current;
            if (!el) return;

            const r = el.getBoundingClientRect();
            if (!rectOk(r)) {
                if (frames < MAX_FRAMES) raf = requestAnimationFrame(tick);
                else raf = requestAnimationFrame(() => requestAnimationFrame(run));
                return;
            }

            const now = { left: r.left, top: r.top, width: r.width, height: r.height };

            if (lastRect) {
                const d = rectDelta(now, lastRect);
                if (d < EPS) stableCount += 1;
                else stableCount = 0;
            }
            lastRect = now;

            const inView = isTargetInViewport(el);

            // Mobile + auto-height panels: if we restored to the section top but the tile is lower, bring it into view once.
            if (isMobileNow() && !inView && frames === 12) {
                nudgeIntoView(el);
                raf = requestAnimationFrame(tick);
                return;
            }

            if (inView && stableCount >= STABLE_FRAMES) {
                raf = requestAnimationFrame(() => requestAnimationFrame(run));
                return;
            }

            if (frames < MAX_FRAMES) {
                raf = requestAnimationFrame(tick);
                return;
            }

            raf = requestAnimationFrame(() => requestAnimationFrame(run));
        };

        const start = () => {
            raf = requestAnimationFrame(tick);
        };

        if ((window as any).__homeHsRestored) {
            start();
        } else {
            const onHomeRestored = () => start();
            window.addEventListener(APP_EVENTS.HOME_HS_RESTORED, onHomeRestored, { once: true });
            return () => {
                window.removeEventListener(APP_EVENTS.HOME_HS_RESTORED, onHomeRestored as any);
                if (raf) cancelAnimationFrame(raf);
            };
        }

        return () => {
            if (raf) cancelAnimationFrame(raf);
        };
    }, [slug, hardResetScale]);

    useLayoutEffect(() => {
        const el = imgScaleRef.current;
        if (!el) return;
        gsap.set(el, { scale: 1, transformOrigin: "50% 50%" });
        return () => {
            gsap.killTweensOf(el);
        };
    }, []);

    const buttonCommonProps = slug
        ? {
            href,
            direction: "up" as const,
            heroSlug: slug,
            heroSourceRef: tileRef as React.RefObject<HTMLDivElement | null>,
            heroImgUrl: imgUrl,
        }
        : { href, direction: "up" as const };

    const isBelow = mobileLayout === "below-left" || mobileLayout === "below-right";
    const isSide = mobileLayout === "left" || mobileLayout === "right";

    // Mobile text alignment to the outside edges (left layouts => left, right layouts => right)
    const isMobileRightAligned =
        mobileLayout === "below-right" || mobileLayout === "right";

    const mobileInfoAlign = isMobileRightAligned ? "items-end text-right" : "items-start text-left";

    const desktopInfoAlign =
        slot.info.align === "right" ? "md:items-end md:text-right" : "md:items-start md:text-left";

    // Aspect-ratio driven image box (mobile) to preserve image shape; clamp tall images.
    const imgAspectStyle = useMemo(() => {
        if (!imgMeta) return undefined;
        return { aspectRatio: `${imgMeta.w} / ${imgMeta.h}` } as React.CSSProperties;
    }, [imgMeta]);

    const cellLayoutClass = cx(
        "gap-6 md:gap-0 md:contents", // increased gap between blocks on mobile
        isBelow && "flex flex-col",
        isSide && "flex items-stretch",
        mobileLayout === "right" && "flex-row",
        mobileLayout === "left" && "flex-row-reverse",
        // keep the side-layout rail height controlled on mobile
        isSide && "h-[46vh] min-h-[260px] max-h-[440px]"
    );

    const imgBoxClass = cx(
        "relative block cursor-pointer z-10",
        // Below layouts: preserve ratio; cap height so portrait images don't get ridiculous.
        isBelow && "w-full max-h-[70vh] md:h-full md:max-h-none",
        // Side layouts: image is full height, width follows aspect ratio (not a forced 50/50 crop).
        isSide && "h-full w-auto shrink-0 max-w-[70%] md:w-full md:max-w-none"
    );

    const infoBoxClass = cx(
        "relative z-10 flex flex-col justify-start w-full",
        mobileInfoAlign,
        desktopInfoAlign,
        isSide && "h-full flex-1 justify-center"
    );

    const objectFit = isMobile ? "contain" : "cover";

    const metaRowClass = cx(
        "-mt-1 flex w-full font-serif text-sm md:text-base tracking-tighter",
        isMobileRightAligned ? "justify-end" : "justify-start",
        "md:justify-start" // desktop alignment handled by md:text-* / md:items-*
    );

    const infoButtonClass = cx(
        "flex flex-col w-full",
        isSide ? "justify-center h-full" : "justify-start",
        mobileInfoAlign,
        desktopInfoAlign
    );

    const imgStyle = useMemo(() => {
        return {
            gridColumn: slot.img.col,
            gridRow: slot.img.row,
            ...(imgAspectStyle ?? {}),
        } as React.CSSProperties;
    }, [slot.img.col, slot.img.row, imgAspectStyle]);

    return (
        <div
            className={cellLayoutClass}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            onFocusCapture={handleEnter}
            onBlurCapture={handleLeave}
            onPointerDownCapture={handleNavLockCapture}
            onClickCapture={handleNavLockCapture}
            data-project-block-cell
        >
            <div
                ref={tileRef}
                className={imgBoxClass}
                style={imgStyle}
                data-dim-item={dimState}
                data-hero-slug={slug || undefined}
                data-hero-target="home"
                data-speed-x="0.97"
            >
                <PageTransitionButton {...buttonCommonProps} className="block w-full h-full cursor-pointer">
                    <div className="relative w-full h-full overflow-hidden">
                        <div
                            ref={imgScaleRef}
                            data-hero-img-scale
                            className="relative w-full h-full will-change-transform transform-gpu"
                        >
                            {imgUrl ? (
                                <SmoothImage
                                    src={imgUrl}
                                    alt={alt}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 25vw"
                                    lqipWidth={24}
                                    hiMaxWidth={1200}
                                    fetchPriority="high"
                                    loading="eager"
                                    objectFit={objectFit}
                                />
                            ) : (
                                <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
                                    No image
                                </div>
                            )}
                        </div>
                    </div>
                </PageTransitionButton>
            </div>

            <div
                className={infoBoxClass}
                style={{ gridColumn: slot.info.col, gridRow: slot.info.row }}
                data-dim-item={dimState}
            >
                <PageTransitionButton {...buttonCommonProps} className={infoButtonClass}>
                    <h3
                        className="text-4xl md:text-4xl font-serif font-bold leading-tight tracking-tight"
                        data-speed-x="0.96"
                    >
                        {item?.title ?? "Untitled"}
                    </h3>

                    <div className={metaRowClass} data-speed-x="0.96">
                        <span>{item?.year ? String(item.year) : "\u00A0"}</span>
                        <span className="mr-1">,</span>
                        <span className="">{item?.client ?? "\u00A0"}</span>
                    </div>
                </PageTransitionButton>
            </div>
        </div>
    );
});

export default function ProjectBlock(props: Props) {
    const themeCtx = useTheme();
    const { clearPreview } = themeCtx;

    const sectionRef = useRef<HTMLElement | null>(null);

    const isScrollingRef = useRef(false);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const dimParticipationRef = useRef(false);

    const width = props.width || "50vw";

    const isPointerOverCell = useCallback(() => {
        if (typeof document === "undefined") return false;

        const pos = getLastMouse();
        if (pos) {
            const hit = document.elementFromPoint(pos.x, pos.y) as HTMLElement | null;
            if (hit && hit.closest("[data-project-block-cell]")) return true;
        }

        return !!document.querySelector("[data-project-block-cell]:hover");
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        let timeoutId: number | null = null;

        const onScroll = () => {
            if (!isScrollingRef.current) {
                isScrollingRef.current = true;
            }

            if (timeoutId !== null) window.clearTimeout(timeoutId);

            timeoutId = window.setTimeout(() => {
                isScrollingRef.current = false;
            }, 0);
        };

        window.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll);
            if (timeoutId !== null) window.clearTimeout(timeoutId);
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const onScrollEnd = () => {
            if (isPointerOverCell()) return;
            clearPreview();
            setActiveIndex(null);
        };

        window.addEventListener(APP_EVENTS.SCROLL_END, onScrollEnd);
        return () => window.removeEventListener(APP_EVENTS.SCROLL_END, onScrollEnd as any);
    }, [clearPreview, isPointerOverCell]);

    useEffect(() => {
        if (typeof document === "undefined" || typeof window === "undefined") return;

        const root = document.documentElement as HTMLElement & { dataset: DOMStringMap };
        const w = window as any;
        if (w.__dimItemsCount == null) w.__dimItemsCount = 0;

        const currentlyActive = activeIndex !== null;

        if (currentlyActive && !dimParticipationRef.current) {
            w.__dimItemsCount += 1;
            dimParticipationRef.current = true;
            root.dataset.dimItems = "true";
        } else if (!currentlyActive && dimParticipationRef.current) {
            w.__dimItemsCount = Math.max(0, (w.__dimItemsCount || 1) - 1);
            dimParticipationRef.current = false;
            if (w.__dimItemsCount === 0) {
                delete root.dataset.dimItems;
            }
        }

        return () => {
            if (dimParticipationRef.current) {
                w.__dimItemsCount = Math.max(0, (w.__dimItemsCount || 1) - 1);
                dimParticipationRef.current = false;
                if (w.__dimItemsCount === 0) {
                    delete root.dataset.dimItems;
                }
            }
        };
    }, [activeIndex]);

    const entries: ProjectLayoutEntry[] = useMemo(() => {
        const raw = props.projects ?? [];

        const defaults: Omit<ProjectLayoutEntry, "project" | "mobileLayout">[] = [
            {
                imageRowStart: 2,
                imageRowEnd: 5,
                imageColStart: 2,
                imageColEnd: 8,
                infoRowStart: 5,
                infoRowEnd: 6,
                infoColStart: 2,
                infoColEnd: 10,
            },
            {
                imageRowStart: 7,
                imageRowEnd: 11,
                imageColStart: 4,
                imageColEnd: 10,
                infoRowStart: 10,
                infoRowEnd: 11,
                infoColStart: 2,
                infoColEnd: 10,
            },
            {
                imageRowStart: 2,
                imageRowEnd: 6,
                imageColStart: 6,
                imageColEnd: 12,
                infoRowStart: 6,
                infoRowEnd: 7,
                infoColStart: 6,
                infoColEnd: 12,
            },
            {
                imageRowStart: 7,
                imageRowEnd: 11,
                imageColStart: 3,
                imageColEnd: 9,
                infoRowStart: 11,
                infoRowEnd: 12,
                infoColStart: 3,
                infoColEnd: 9,
            },
        ];

        const clampN = (value: number, min: number, max: number) =>
            Math.min(max, Math.max(min, value));

        return raw
            .slice(0, 4)
            .map((p, index) => {
                const project = p?.project;
                if (!project) return null;

                const fallback = defaults[index] ?? defaults[0];

                let imageRowStart =
                    typeof p.imageRowStart === "number" && p.imageRowStart > 0
                        ? p.imageRowStart
                        : fallback.imageRowStart;
                imageRowStart = clampN(imageRowStart, 1, 12);

                let imageRowEnd =
                    typeof p.imageRowEnd === "number" && p.imageRowEnd > imageRowStart
                        ? p.imageRowEnd
                        : fallback.imageRowEnd;
                imageRowEnd = clampN(imageRowEnd, imageRowStart + 1, 13);

                let imageColStart =
                    typeof p.imageColStart === "number" && p.imageColStart > 0
                        ? p.imageColStart
                        : fallback.imageColStart;
                imageColStart = clampN(imageColStart, 1, 12);

                let imageColEnd =
                    typeof p.imageColEnd === "number" && p.imageColEnd > imageColStart
                        ? p.imageColEnd
                        : fallback.imageColEnd;
                imageColEnd = clampN(imageColEnd, imageColStart + 1, 13);

                let infoRowStart =
                    typeof p.infoRowStart === "number" && p.infoRowStart > 0
                        ? p.infoRowStart
                        : fallback.infoRowStart;
                infoRowStart = clampN(infoRowStart, 1, 12);

                let infoRowEnd =
                    typeof p.infoRowEnd === "number" && p.infoRowEnd > infoRowStart
                        ? p.infoRowEnd
                        : fallback.infoRowEnd;
                infoRowEnd = clampN(infoRowEnd, infoRowStart + 1, 13);

                let infoColStart =
                    typeof p.infoColStart === "number" && p.infoColStart > 0
                        ? p.infoColStart
                        : fallback.infoColStart;
                infoColStart = clampN(infoColStart, 1, 12);

                let infoColEnd =
                    typeof p.infoColEnd === "number" && p.infoColEnd > infoColStart
                        ? p.infoColEnd
                        : fallback.infoColEnd;
                infoColEnd = clampN(infoColEnd, infoColStart + 1, 13);

                return {
                    project,
                    mobileLayout: normalizeMobileLayout(p?.mobileLayout),
                    imageRowStart,
                    imageRowEnd,
                    imageColStart,
                    imageColEnd,
                    infoRowStart,
                    infoRowEnd,
                    infoColStart,
                    infoColEnd,
                };
            })
            .filter((x): x is ProjectLayoutEntry => !!x);
    }, [props.projects]);

    const hasProjects = entries.length > 0;

    return (
        <section
            ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
            data-panel-height="auto"
            className={cx(
                // Mobile: px-12 sides, py-20. Larger gaps between blocks.
                "relative px-20 py-32 flex flex-col gap-18 overflow-visible",
                // Desktop unchanged
                "md:p-6 md:h-screen md:overflow-hidden md:gap-2 md:grid md:grid-cols-12 md:grid-rows-12",
                "will-change-transform transform-gpu",
                "w-screen md:w-[var(--pb-width)]",
                "md:[contain-intrinsic-size:100vh_50vw]"
            )}
            style={{ ["--pb-width" as any]: width }}
        >
            {props.title ? (
                <div className="pointer-events-none px-0 md:px-6 will-change-transform transform-gpu md:[grid-column:1/span_8] md:[grid-row:1/span_1] md:self-center">
                    <h2 className="text-base md:text-xl italic tracking-tight will-change-transform transform-gpu">
                        {props.title}
                    </h2>
                </div>
            ) : null}

            {hasProjects ? (
                entries.map((entry, index) => {
                    const key = entry.project.slug ?? String(index);

                    const slot: Slot = {
                        img: {
                            col: `${entry.imageColStart} / ${entry.imageColEnd}`,
                            row: `${entry.imageRowStart} / ${entry.imageRowEnd}`,
                        },
                        info: {
                            col: `${entry.infoColStart} / ${entry.infoColEnd}`,
                            row: `${entry.infoRowStart} / ${entry.infoRowEnd}`,
                            align: entry.infoColStart >= 7 ? "right" : "left",
                        },
                    };

                    return (
                        <ProjectBlockCell
                            key={key}
                            item={entry.project}
                            slot={slot}
                            mobileLayout={entry.mobileLayout}
                            themeCtx={themeCtx}
                            index={index}
                            activeIndex={activeIndex}
                            setActiveIndex={setActiveIndex}
                            isScrollingRef={isScrollingRef}
                        />
                    );
                })
            ) : (
                <div className="grid place-items-center text-xs opacity-60 md:[grid-column:1/span_12] md:[grid-row:1/span_12]">
                    No projects
                </div>
            )}

            <SectionScrollLine triggerRef={sectionRef} enabled />
        </section>
    );
}
