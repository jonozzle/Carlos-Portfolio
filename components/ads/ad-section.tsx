// src: components/ads/ad-section.tsx
"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { PAGE_QUERYResult } from "@/sanity.types";
import { type AdvertImage } from "@/components/ads/advert";
import HorizontalImageSlider from "@/components/ads/horizontal-image-slider";
import VerticalImageSlider from "@/components/ads/vertical-image-slider";
import { useThemeActions } from "@/components/theme-provider";
import { APP_EVENTS } from "@/lib/app-events";
import { getLastMouse, HOVER_EVENTS, isHoverLocked } from "@/lib/hover-lock";
import { useHoverCapable } from "@/lib/use-hover-capable";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];
type AdBlock = Extract<Block, { _type: "ad-section" }>;
type Props = AdBlock;

function isAppScrolling() {
    if (typeof window === "undefined") return false;
    return !!(window as any).__appScrolling;
}

function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mql = window.matchMedia(query);
        const onChange = () => setMatches(mql.matches);

        onChange();

        if (typeof mql.addEventListener === "function") {
            mql.addEventListener("change", onChange);
            return () => mql.removeEventListener("change", onChange);
        }

        mql.addListener(onChange);
        return () => mql.removeListener(onChange);
    }, [query]);

    return matches;
}

type ParallaxAmount = "sm" | "md" | "lg";
type Orientation = "horizontal" | "vertical";
type SectionWidth = "narrow" | "medium" | "wide" | "full" | "auto";

type MobileHeight =
    | "ratio-1-1"
    | "ratio-4-5"
    | "ratio-3-4"
    | "ratio-16-9"
    | "vh-100"
    | "vh-50";

function mobileHeightStyle(opt: MobileHeight | null | undefined): React.CSSProperties {
    switch (opt) {
        case "vh-100":
            return { height: "100vh" };
        case "vh-50":
            return { height: "50vh" };
        case "ratio-1-1":
            return { aspectRatio: "1 / 1" };
        case "ratio-4-5":
            return { aspectRatio: "4 / 5" };
        case "ratio-3-4":
            return { aspectRatio: "3 / 4" };
        case "ratio-16-9":
            return { aspectRatio: "16 / 9" };
        default:
            return { aspectRatio: "4 / 5" };
    }
}

export default function AdSection({
    images,
    title,
    theme,
    desktop,
    mobile,
}: Props) {
    const themeActions = useThemeActions();
    const hasTheme = !!(theme?.bg || theme?.text);
    const hoverCapable = useHoverCapable();

    const sectionRef = useRef<HTMLElement | null>(null);

    const isDesktop = useMediaQuery("(min-width: 768px)"); // below tablet => mobile settings
    const [viewportHeight, setViewportHeight] = useState(0);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const update = () => setViewportHeight(Math.max(0, window.innerHeight || 0));
        update();
        window.addEventListener("resize", update, { passive: true });
        return () => window.removeEventListener("resize", update as any);
    }, []);

    const desktopCfg = (desktop ?? {}) as {
        orientation?: Orientation | null;
        parallaxEnabled?: boolean | null;
        parallaxAmount?: ParallaxAmount | null;
        sectionWidth?: SectionWidth | null;
    };

    const mobileCfg = (mobile ?? {}) as {
        orientation?: Orientation | null;
        parallaxEnabled?: boolean | null;
        parallaxAmount?: ParallaxAmount | null;
        height?: MobileHeight | null;
    };

    const effectiveOrientation: Orientation =
        (isDesktop ? desktopCfg.orientation : mobileCfg.orientation) ??
        desktopCfg.orientation ??
        "horizontal";

    const effectiveParallaxEnabled: boolean =
        (isDesktop ? desktopCfg.parallaxEnabled : mobileCfg.parallaxEnabled) ??
        desktopCfg.parallaxEnabled ??
        true;

    const effectiveParallaxAmount: ParallaxAmount =
        (isDesktop ? desktopCfg.parallaxAmount : mobileCfg.parallaxAmount) ??
        desktopCfg.parallaxAmount ??
        "md";

    const desktopSectionWidth: SectionWidth = desktopCfg.sectionWidth ?? "medium";

    const imgs: AdvertImage[] | null = useMemo(
        () =>
            images?.map((i) => ({
                asset: {
                    url: i.asset?.url ?? null,
                    width: i.asset?.width ?? null,
                    height: i.asset?.height ?? null,
                },
                alt: i.alt ?? null,
            })) ?? null,
        [images]
    );

    const desktopAutoDimensions = useMemo(() => {
        if (desktopSectionWidth !== "auto") return null;

        for (const img of imgs ?? []) {
            const width = img.asset?.width;
            const height = img.asset?.height;
            if (
                typeof width === "number" &&
                Number.isFinite(width) &&
                width > 0 &&
                typeof height === "number" &&
                Number.isFinite(height) &&
                height > 0
            ) {
                return { width: Math.round(width), height: Math.round(height) };
            }
        }

        return null;
    }, [desktopSectionWidth, imgs]);

    const applyTheme = useCallback(
        (allowIdle?: boolean, force?: boolean) => {
            if (!hasTheme) return;
            const forceAnim = typeof force === "boolean" ? force : isAppScrolling();
            themeActions.previewTheme(theme, { animate: true, force: forceAnim, allowIdle: !!allowIdle });
        },
        [hasTheme, themeActions, theme]
    );

    const clearTheme = useCallback(
        (force?: boolean) => {
            if (!hasTheme) return;
            const forceAnim = typeof force === "boolean" ? force : isAppScrolling();
            themeActions.clearPreview({ animate: true, force: forceAnim });
        },
        [hasTheme, themeActions]
    );

    const isPointerInside = useCallback(() => {
        if (!hoverCapable) return false;
        if (typeof document === "undefined") return false;
        const el = sectionRef.current;
        if (!el) return false;

        const pos = getLastMouse();
        if (pos) {
            const hit = document.elementFromPoint(pos.x, pos.y);
            return !!(hit && el.contains(hit));
        }

        return el.matches(":hover");
    }, [hoverCapable]);

    useEffect(() => {
        if (typeof window === "undefined" || !hasTheme) return;

        const onScrollEnd = () => {
            if (isHoverLocked()) return;
            if (!hoverCapable) {
                clearTheme();
                return;
            }
            if (isPointerInside()) applyTheme(true);
            else clearTheme();
        };

        window.addEventListener(APP_EVENTS.SCROLL_END, onScrollEnd);
        return () => window.removeEventListener(APP_EVENTS.SCROLL_END, onScrollEnd as any);
    }, [applyTheme, clearTheme, hasTheme, hoverCapable, isPointerInside]);

    useEffect(() => {
        if (typeof window === "undefined" || !hasTheme) return;

        const onUnlocked = () => {
            if (!hoverCapable) return;
            if (isPointerInside()) applyTheme(true);
        };

        window.addEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked);
        return () => window.removeEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked as any);
    }, [applyTheme, hasTheme, hoverCapable, isPointerInside]);

    const isVertical = effectiveOrientation === "vertical";
    const lockCrossAxisBleed =
        isDesktop && desktopSectionWidth === "auto" && isVertical && effectiveParallaxEnabled;

    const sectionWidthClass = useMemo(() => {
        switch (desktopSectionWidth) {
            case "narrow":
                return "w-full md:w-[35vw]";
            case "medium":
                return "w-full md:w-[50vw]";
            case "wide":
                return "w-full md:w-[65vw]";
            case "full":
                return "w-full md:w-screen";
            case "auto":
                return "w-full md:w-auto";
            default:
                return "w-full md:w-[50vw]";
        }
    }, [desktopSectionWidth]);

    const sliderSize = useMemo(() => {
        if (!isDesktop) return "full" as const;

        switch (desktopSectionWidth) {
            case "full":
                return "full" as const;
            case "narrow":
                return "half" as const;
            default:
                return "auto" as const;
        }
    }, [desktopSectionWidth, isDesktop]);

    const sectionStyle: React.CSSProperties = useMemo(() => {
        const style: React.CSSProperties = {
            containIntrinsicSize: isDesktop ? "100vh 50vw" : "60vh 100vw",
        };

        if (isDesktop && desktopSectionWidth === "auto") {
            style.height = "100vh";
            style.maxHeight = "100vh";
            style.width = "auto";
            style.maxWidth = "none";

            if (desktopAutoDimensions) {
                const imageAspect = desktopAutoDimensions.width / desktopAutoDimensions.height;
                const vh = Math.max(1, viewportHeight || 1);
                let widthPx = imageAspect * vh;

                if (lockCrossAxisBleed) {
                    const parallaxScale =
                        effectiveParallaxAmount === "sm" ? 0.6 : effectiveParallaxAmount === "lg" ? 1.4 : 1;
                    const pan = clamp(clamp(vh * 0.08, 16, 140) * parallaxScale, 8, 180);
                    widthPx = imageAspect * (vh + pan * 2);
                }

                style.width = `${Math.round(widthPx)}px`;
                style.aspectRatio = `${desktopAutoDimensions.width} / ${desktopAutoDimensions.height}`;
            } else {
                style.width = "auto";
            }
        }

        return style;
    }, [desktopAutoDimensions, desktopSectionWidth, effectiveParallaxAmount, isDesktop, lockCrossAxisBleed, viewportHeight]);

    const sliderLabel = title ?? "Ad section";

    return (
        <section
            ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
            className={clsx(
                "flex flex-none relative overflow-hidden will-change-transform transform-gpu items-center justify-start",
                isDesktop ? "h-screen" : "h-auto",
                sectionWidthClass
            )}
            style={sectionStyle}
            aria-label={sliderLabel}
            data-cursor-blend="normal"
            data-cursor-tone="ad-muted"
            onPointerEnter={() => {
                if (isHoverLocked()) return;
                applyTheme();
            }}
            onPointerLeave={() => {
                if (isHoverLocked()) return;
                if (isAppScrolling() && isPointerInside()) return;
                clearTheme(isAppScrolling());
            }}
            onFocusCapture={() => {
                if (isHoverLocked()) return;
                applyTheme();
            }}
            onBlurCapture={() => {
                if (isHoverLocked()) return;
                clearTheme(isAppScrolling());
            }}
        >
            <div
                className={clsx("relative w-full", isDesktop ? "h-full" : "h-auto")}
                style={!isDesktop ? mobileHeightStyle(mobileCfg.height) : undefined}
            >
                {isVertical ? (
                    <VerticalImageSlider
                        images={imgs ?? []}
                        size={sliderSize}
                        label={sliderLabel}
                        className="h-full w-full"
                        parallaxEnabled={effectiveParallaxEnabled}
                        parallaxAmount={effectiveParallaxAmount}
                        lockCrossAxisBleed={lockCrossAxisBleed}
                    />
                ) : (
                    <HorizontalImageSlider
                        images={imgs ?? []}
                        size={sliderSize}
                        label={sliderLabel}
                        className="h-full w-full"
                        parallaxEnabled={effectiveParallaxEnabled}
                        parallaxAmount={effectiveParallaxAmount}
                        lockCrossAxisBleed={lockCrossAxisBleed}
                    />
                )}
            </div>
        </section>
    );
}
