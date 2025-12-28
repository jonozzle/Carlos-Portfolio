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
import { useTheme } from "@/components/theme-provider";
import PageTransitionButton from "@/components/page-transition-button";
import { completeHeroTransition } from "@/lib/hero-transition";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { APP_EVENTS } from "@/lib/app-events";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

type Theme = {
    bg?: any;
    text?: any;
} | null;

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
    themeCtx: ThemeContext;
    index: number;
    activeIndex: number | null;
    setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>;
    isScrollingRef: React.MutableRefObject<boolean>;
};

const ProjectBlockCell = React.memo(function ProjectBlockCell({
    item,
    slot,
    themeCtx,
    index,
    activeIndex,
    setActiveIndex,
    isScrollingRef,
}: CellProps) {
    const tileRef = useRef<HTMLDivElement | null>(null);
    const imgScaleRef = useRef<HTMLDivElement | null>(null);

    const slug = item?.slug ?? "";
    const href = slug ? `/projects/${slug}` : "#";
    const imgUrl = item?.image?.asset?.url || "";
    const alt = item?.image?.alt ?? item?.title ?? "Project image";
    const theme = item?.theme ?? null;
    const hasTheme = !!(theme?.bg || theme?.text);

    const { previewTheme, clearPreview } = themeCtx;

    const isActive = activeIndex === index && !isScrollingRef.current;
    const dimState: "active" | "inactive" = isActive ? "active" : "inactive";

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

    const clearHover = useCallback(() => {
        if (hasTheme) clearPreview();
        setActiveIndex((prev) => (prev === index ? null : prev));
        animateScale(1);
    }, [hasTheme, clearPreview, setActiveIndex, index, animateScale]);

    const handleEnter = useCallback(() => {
        if (isScrollingRef.current) return;
        if (hasTheme) previewTheme(theme);
        setActiveIndex(index);
        animateScale(1.1);
    }, [hasTheme, previewTheme, theme, setActiveIndex, index, isScrollingRef, animateScale]);

    const handleLeave = useCallback(() => {
        if (isScrollingRef.current) return;
        clearHover();
    }, [clearHover, isScrollingRef]);

    // Project -> Home: overlay targets this tile
    useLayoutEffect(() => {
        if (typeof window === "undefined") return;
        if (!slug) return;
        if (!tileRef.current) return;

        const pending = (window as any).__heroPending as { slug?: string } | undefined;
        const match = !!pending && pending.slug === slug;
        if (!match) return;

        let ran = false;

        const run = () => {
            if (ran) return;
            ran = true;
            if (!tileRef.current) return;

            completeHeroTransition({
                slug,
                targetEl: tileRef.current,
                mode: "parkThenPage",
            });
        };

        const onHomeRestored = () => {
            requestAnimationFrame(() => requestAnimationFrame(run));
        };

        window.addEventListener(APP_EVENTS.HOME_HS_RESTORED, onHomeRestored, { once: true });

        return () => {
            window.removeEventListener(APP_EVENTS.HOME_HS_RESTORED, onHomeRestored as any);
        };
    }, [slug]);

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

    return (
        <div
            className="contents"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            onFocusCapture={handleEnter}
            onBlurCapture={handleLeave}
        >
            <div
                ref={tileRef}
                className="relative block cursor-pointer z-10"
                style={{ gridColumn: slot.img.col, gridRow: slot.img.row }}
                data-dim-item={dimState}
                data-hero-slug={slug || undefined}
                data-hero-target="home"
                data-speed-x="0.97"
            >
                <PageTransitionButton {...buttonCommonProps} className="block w-full h-full cursor-pointer">
                    <div className="relative w-full h-full overflow-hidden">
                        <div ref={imgScaleRef} className="relative w-full h-full will-change-transform transform-gpu">
                            {imgUrl ? (
                                <SmoothImage
                                    src={imgUrl}
                                    alt={alt}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 25vw"
                                    lqipWidth={16}
                                    hiMaxWidth={900}
                                    fetchPriority="high"
                                    objectFit="cover"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="absolute inset-0 grid place-items-center text-xs opacity-60">No image</div>
                            )}
                        </div>
                    </div>
                </PageTransitionButton>
            </div>

            <div
                className="relative z-10 flex flex-col justify-start text-left flex-start"
                style={{ gridColumn: slot.info.col, gridRow: slot.info.row }}
                data-dim-item={dimState}
            >
                <PageTransitionButton {...buttonCommonProps} className="flex flex-col items-start text-left">
                    <h3 className="text-lg md:text-4xl font-serif font-bold leading-tight tracking-tighter" data-speed-x="0.96">
                        {item?.title ?? "Untitled"}
                    </h3>
                    <div className="-mt-1 flex w-full font-serif text-sm md:text-base tracking-tighter" data-speed-x="0.95">
                        <span>{item?.year ? String(item.year) : "\u00A0"}</span>
                        <span className="mr-1">,</span>
                        <span className="italic">{item?.client ?? "\u00A0"}</span>
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
    const progressRef = useRef<HTMLDivElement | null>(null);

    const isScrollingRef = useRef(false);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const width = props.width || "50vw";

    // Global scroll flags (replaces per-block scroll listeners that cause end-of-scroll hitch)
    useEffect(() => {
        if (typeof window === "undefined") return;

        const onStart = () => {
            isScrollingRef.current = true;
            // clear hover state at scroll START only (no end-of-scroll work)
            clearPreview();
            setActiveIndex(null);
        };

        const onEnd = () => {
            isScrollingRef.current = false;
        };

        window.addEventListener(APP_EVENTS.SCROLL_START, onStart);
        window.addEventListener(APP_EVENTS.SCROLL_END, onEnd);

        return () => {
            window.removeEventListener(APP_EVENTS.SCROLL_START, onStart);
            window.removeEventListener(APP_EVENTS.SCROLL_END, onEnd);
        };
    }, [clearPreview]);

    useEffect(() => {
        if (typeof document === "undefined") return;
        const root = document.documentElement;

        if (activeIndex !== null && !isScrollingRef.current) {
            (root as any).dataset.dimItems = "true";
        } else {
            delete (root as any).dataset.dimItems;
        }
    }, [activeIndex]);

    const entries: ProjectLayoutEntry[] = useMemo(() => {
        const raw = props.projects ?? [];

        const defaults: ProjectLayoutEntry[] = [
            {
                project: (raw[0]?.project ?? null) as any,
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
                project: (raw[1]?.project ?? null) as any,
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
                project: (raw[2]?.project ?? null) as any,
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
                project: (raw[3]?.project ?? null) as any,
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

        const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

        return raw
            .slice(0, 4)
            .map((p, index) => {
                const project = p?.project;
                if (!project) return null;

                const fallback = defaults[index] ?? defaults[0];

                let imageRowStart =
                    typeof p.imageRowStart === "number" && p.imageRowStart > 0 ? p.imageRowStart : fallback.imageRowStart;
                imageRowStart = clamp(imageRowStart, 1, 12);

                let imageRowEnd =
                    typeof p.imageRowEnd === "number" && p.imageRowEnd > imageRowStart ? p.imageRowEnd : fallback.imageRowEnd;
                imageRowEnd = clamp(imageRowEnd, imageRowStart + 1, 13);

                let imageColStart =
                    typeof p.imageColStart === "number" && p.imageColStart > 0 ? p.imageColStart : fallback.imageColStart;
                imageColStart = clamp(imageColStart, 1, 12);

                let imageColEnd =
                    typeof p.imageColEnd === "number" && p.imageColEnd > imageColStart ? p.imageColEnd : fallback.imageColEnd;
                imageColEnd = clamp(imageColEnd, imageColStart + 1, 13);

                let infoRowStart =
                    typeof p.infoRowStart === "number" && p.infoRowStart > 0 ? p.infoRowStart : fallback.infoRowStart;
                infoRowStart = clamp(infoRowStart, 1, 12);

                let infoRowEnd =
                    typeof p.infoRowEnd === "number" && p.infoRowEnd > infoRowStart ? p.infoRowEnd : fallback.infoRowEnd;
                infoRowEnd = clamp(infoRowEnd, infoRowStart + 1, 13);

                let infoColStart =
                    typeof p.infoColStart === "number" && p.infoColStart > 0 ? p.infoColStart : fallback.infoColStart;
                infoColStart = clamp(infoColStart, 1, 12);

                let infoColEnd =
                    typeof p.infoColEnd === "number" && p.infoColEnd > infoColStart ? p.infoColEnd : fallback.infoColEnd;
                infoColEnd = clamp(infoColEnd, infoColStart + 1, 13);

                return {
                    project,
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

    // Progress line (unchanged behavior)
    useLayoutEffect(() => {
        if (typeof window === "undefined") return;

        const sectionEl = sectionRef.current;
        const progressEl = progressRef.current;
        if (!sectionEl || !progressEl) return;

        gsap.set(progressEl, { scaleX: 0, transformOrigin: "left center" });

        let st: ScrollTrigger | null = null;
        let checkId: number | null = null;

        const setup = () => {
            const horizontalST = ScrollTrigger.getById("hs-horizontal") as ScrollTrigger | null;
            const containerAnim = horizontalST?.animation as gsap.core.Animation | undefined;
            if (!horizontalST || !containerAnim) return false;

            st?.kill();
            st = ScrollTrigger.create({
                trigger: sectionEl,
                containerAnimation: containerAnim,
                start: "left 80%",
                end: "right 20%",
                scrub: true,
                onUpdate: (self) => {
                    gsap.set(progressEl, { scaleX: self.progress });
                },
            });

            return true;
        };

        if (!setup()) {
            const trySetup = () => {
                if (setup()) return;
                checkId = window.setTimeout(trySetup, 100);
            };
            checkId = window.setTimeout(trySetup, 100);
        }

        return () => {
            st?.kill();
            if (checkId !== null) window.clearTimeout(checkId);
        };
    }, []);

    return (
        <section
            ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
            className="h-screen p-2 gap-2 grid grid-cols-12 grid-rows-12 relative overflow-hidden will-change-transform transform-gpu"
            style={{ width, containIntrinsicSize: "100vh 50vw" }}
        >
            {props.title ? (
                <div
                    className="pointer-events-none px-4 md:px-6 will-change-transform transform-gpu"
                    style={{
                        gridColumn: "1 / span 8",
                        gridRow: "1 / span 1",
                        alignSelf: "center",
                    }}
                >
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
                            themeCtx={themeCtx}
                            index={index}
                            activeIndex={activeIndex}
                            setActiveIndex={setActiveIndex}
                            isScrollingRef={isScrollingRef}
                        />
                    );
                })
            ) : (
                <div
                    className="col-span-12 row-span-12 grid place-items-center text-xs opacity-60"
                    style={{ gridColumn: "1 / span 12", gridRow: "1 / span 12" }}
                >
                    No projects
                </div>
            )}

            <div className="pointer-events-none absolute left-0 right-0 bottom-10 px-2 md:px-4 will-change-transform transform-gpu">
                <div className="relative h-px w-full">
                    <div className="absolute inset-0 bg-current opacity-10" />
                    <div
                        ref={progressRef}
                        className="absolute inset-0 bg-current origin-left will-change-transform transform-gpu"
                        style={{ transform: "scaleX(0)" }}
                    />
                </div>
            </div>
        </section>
    );
}
