// components/blocks/half-width-double-project.tsx
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
import { predecodeNextImages } from "@/lib/predecode";
import PageTransitionButton from "@/components/page-transition-button";
import { completeHeroTransition } from "@/lib/hero-transition";

const SCROLL_IDLE_DELAY = 500;

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

type TextPosition = "below-left" | "top-right";

type DoubleProjectItem = {
    textPosition?: TextPosition | null;
    project?: SingleGalleryItem | null;
};

type Props = {
    _type: "half-width-double-project";
    _key: string;
    title?: string | null;
    projects?: DoubleProjectItem[] | null;
};

type Slot = {
    img: { col: string; row: string };
    info: { col: string; row: string; align?: "left" | "right" };
};

const BASE_SLOTS: {
    img: { col: string; row: string };
    infoBelow: { col: string; row: string; align: "left" | "right" };
    infoRight: { col: string; row: string; align: "left" | "right" };
}[] = [
        {
            // Top project
            img: { col: "2 / span 7", row: "2 / span 3" },
            infoBelow: { col: "2 / span 10", row: "5 / span 1", align: "left" },
            infoRight: { col: "9 / span 3", row: "2 / span 2", align: "right" },
        },
        {
            // Bottom project
            img: { col: "4 / span 4", row: "7 / span 5" },
            infoBelow: { col: "2 / span 10", row: "10 / span 1", align: "left" },
            infoRight: { col: "8 / span 3", row: "7 / span 2", align: "right" },
        },
    ];

type ThemeContext = ReturnType<typeof useTheme>;

type CellProps = {
    item: SingleGalleryItem;
    slot: Slot;
    themeCtx: ThemeContext;
    index: number;
    activeIndex: number | null;
    setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>;
    isScrollingRef: React.MutableRefObject<boolean>;
};

const HalfWidthDoubleProjectCell = React.memo(function HalfWidthDoubleProjectCell({
    item,
    slot,
    themeCtx,
    index,
    activeIndex,
    setActiveIndex,
    isScrollingRef,
}: CellProps) {
    const tileRef = useRef<HTMLDivElement | null>(null);

    const slug = item?.slug ?? "";
    const href = slug ? `/projects/${slug}` : "#";
    const imgUrl = item?.image?.asset?.url || "";
    const alt = item?.image?.alt ?? item?.title ?? "Project image";
    const theme = item?.theme ?? null;
    const hasTheme = !!(theme?.bg || theme?.text);

    const { previewTheme, clearPreview } = themeCtx;

    const isActive = activeIndex === index && !isScrollingRef.current;
    const dimState: "active" | "inactive" = isActive ? "active" : "inactive";

    const [heroState, setHeroState] = useState<"idle" | "transitioning" | "shown">(
        () => {
            if (typeof window === "undefined" || !slug) return "idle";
            const pending = (window as any).__heroPending as
                | { slug?: string }
                | undefined;
            return pending?.slug === slug ? "transitioning" : "idle";
        }
    );
    const [isHeroMatch, setIsHeroMatch] = useState(false);

    const clearHover = useCallback(() => {
        if (hasTheme) clearPreview();
        setActiveIndex((prev) => (prev === index ? null : prev));
    }, [hasTheme, clearPreview, setActiveIndex, index]);

    const handleEnter = useCallback(() => {
        if (isScrollingRef.current) return;
        if (hasTheme) previewTheme(theme);
        setActiveIndex(index);
    }, [hasTheme, previewTheme, theme, setActiveIndex, index, isScrollingRef]);

    const handleLeave = useCallback(() => {
        if (isScrollingRef.current) return;
        clearHover();
    }, [clearHover, isScrollingRef]);

    // Hero overlay → this tile (project → home case)
    useLayoutEffect(() => {
        if (typeof window === "undefined") return;
        if (!slug) return;
        if (!tileRef.current) return;

        const pending = (window as any).__heroPending as
            | { slug?: string }
            | undefined;

        const match = !!pending && pending.slug === slug;
        setIsHeroMatch(match);

        // Debug – optional, can remove once happy
        // eslint-disable-next-line no-console
        console.log("[HalfWidthDoubleProjectCell hero]", {
            tileSlug: slug,
            pendingSlug: pending?.slug,
            hasPending: !!pending,
        });

        if (match) {
            setHeroState("transitioning");

            completeHeroTransition({
                slug,
                targetEl: tileRef.current,
                mode: "parkThenPage",
            });
        }

        const onHeroShow = (event: Event) => {
            const detail = (event as CustomEvent).detail as
                | { slug?: string }
                | undefined;
            if (detail?.slug === slug) {
                setHeroState("shown");
            }
        };

        window.addEventListener("hero-page-hero-show", onHeroShow);
        return () => {
            window.removeEventListener("hero-page-hero-show", onHeroShow);
        };
    }, [slug]);

    // Shared props for PageTransitionButton (home → project case)
    const buttonCommonProps = slug
        ? {
            href,
            direction: "up" as const,
            heroSlug: slug,
            heroSourceRef: tileRef as React.RefObject<HTMLDivElement | null>,
            heroImgUrl: imgUrl,
        }
        : {
            href,
            direction: "up" as const,
        };

    // If this tile is the hero match, keep its image hidden until
    // hero-page-hero-show fires (heroState === "shown").
    const isHeroImageHidden = isHeroMatch && heroState !== "shown";

    return (
        <div
            className="contents"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            onFocusCapture={handleEnter}
            onBlurCapture={handleLeave}
        >
            {/* IMAGE TILE – hero source/target */}
            <div
                ref={tileRef}
                className="relative block cursor-pointer z-10"
                style={{ gridColumn: slot.img.col, gridRow: slot.img.row }}
                data-dim-item={dimState}
                data-hero-slug={slug || undefined}
            >
                <PageTransitionButton
                    {...buttonCommonProps}
                    className="block w-full h-full cursor-pointer"
                >
                    <div
                        className="relative w-full h-full overflow-hidden"
                        style={{ opacity: isHeroImageHidden ? 0 : 1 }}
                    >
                        {imgUrl ? (
                            <SmoothImage
                                src={imgUrl}
                                alt={alt}
                                fill
                                sizes="(max-width: 768px) 100vw, 25vw"
                                lqipWidth={24}
                                objectFit="cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
                                No image
                            </div>
                        )}
                    </div>
                </PageTransitionButton>
            </div>

            {/* INFO BLOCK */}
            <div
                className="relative z-10 flex flex-col justify-start text-left"
                style={{
                    gridColumn: slot.info.col,
                    gridRow: slot.info.row,
                    alignItems: "flex-start",
                }}
                data-dim-item={dimState}
            >
                <PageTransitionButton
                    {...buttonCommonProps}
                    className="flex flex-col items-start text-left"
                >
                    <h3 className="text-lg md:text-4xl font-serif font-bold leading-tight tracking-tighter">
                        {item?.title ?? "Untitled"}
                    </h3>
                    <div className="-mt-1 flex w-full font-serif text-sm md:text-base tracking-tighter">
                        <span>{item?.year ? String(item.year) : "\u00A0"}</span>
                        <span className="mr-1">,</span>
                        <span className="italic">{item?.client ?? "\u00A0"}</span>
                    </div>
                </PageTransitionButton>
            </div>
        </div>
    );
});

export default function HalfWidthDoubleProject(props: Props) {
    const themeCtx = useTheme();
    const { clearPreview } = themeCtx;

    const entries = useMemo(
        () =>
            (props.projects ?? [])
                .map((p) => ({
                    project: p?.project ?? null,
                    textPosition:
                        (p?.textPosition as TextPosition | undefined) ?? "below-left",
                }))
                .filter((p) => p.project) as {
                    project: SingleGalleryItem;
                    textPosition: TextPosition;
                }[],
        [props.projects]
    );

    const hasProjects = entries.length > 0;

    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const isScrollingRef = useRef(false);
    const sectionRef = useRef<HTMLElement | null>(null);

    // Scroll listener: avoid hover / theme updates while scrolling
    useEffect(() => {
        if (typeof window === "undefined") return;

        let timeoutId: number | null = null;

        const onScroll = () => {
            if (!isScrollingRef.current) {
                isScrollingRef.current = true;

                if (sectionRef.current) {
                    sectionRef.current.style.pointerEvents = "none";
                }

                setActiveIndex(null);
                clearPreview();

                const root = document.documentElement;
                delete root.dataset.dimItems;
            }

            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }

            timeoutId = window.setTimeout(() => {
                isScrollingRef.current = false;
                if (sectionRef.current) {
                    sectionRef.current.style.pointerEvents = "";
                }
            }, SCROLL_IDLE_DELAY);
        };

        window.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll);
            if (timeoutId !== null) window.clearTimeout(timeoutId);
        };
    }, [clearPreview]);

    // Toggle global dim flag based on active state
    useEffect(() => {
        if (typeof document === "undefined") return;
        const root = document.documentElement;

        if (activeIndex !== null && !isScrollingRef.current) {
            root.dataset.dimItems = "true";
        } else {
            delete root.dataset.dimItems;
        }
    }, [activeIndex]);

    // Pre-decode images when this section is approaching the viewport
    useEffect(() => {
        if (typeof window === "undefined" || !sectionRef.current) return;

        const sectionEl = sectionRef.current;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting || entry.intersectionRatio > 0) {
                    predecodeNextImages(sectionEl, 8);
                    observer.disconnect();
                }
            },
            {
                root: null,
                rootMargin: "50% 0px",
                threshold: 0,
            }
        );

        observer.observe(sectionEl);

        return () => observer.disconnect();
    }, []);

    return (
        <section
            ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
            className="w-[50vw] h-screen p-2 gap-2 grid grid-cols-12 grid-rows-12 relative overflow-hidden will-change-transform"
            style={{
                //contentVisibility: "auto",
                //contain: "layout paint style",
                containIntrinsicSize: "100vh 50vw",
            }}
        >
            {props.title ? (
                <div
                    className="pointer-events-none px-4 md:px-6"
                    style={{
                        gridColumn: "1 / span 8",
                        gridRow: "1 / span 1",
                        alignSelf: "center",
                    }}
                >
                    <h2 className="text-base md:text-xl italic tracking-tight">
                        {props.title}
                    </h2>
                </div>
            ) : null}

            {hasProjects ? (
                entries.slice(0, 2).map((entry, index) => {
                    const base = BASE_SLOTS[index] ?? BASE_SLOTS[BASE_SLOTS.length - 1];
                    const slot: Slot = {
                        img: base.img,
                        info:
                            entry.textPosition === "top-right"
                                ? base.infoRight
                                : base.infoBelow,
                    };

                    const key = entry.project.slug ?? String(index);

                    return (
                        <HalfWidthDoubleProjectCell
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
        </section>
    );
}
