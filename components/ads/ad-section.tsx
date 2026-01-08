// components/ads/ad-section.tsx
"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import { PAGE_QUERYResult } from "@/sanity.types";
import { type AdvertImage } from "@/components/ads/advert";
import HorizontalImageSlider from "@/components/ads/horizontal-image-slider";
import VerticalImageSlider from "@/components/ads/vertical-image-slider";
import { useThemeActions } from "@/components/theme-provider";
import { APP_EVENTS } from "@/lib/app-events";
import { getLastMouse, HOVER_EVENTS, isHoverLocked } from "@/lib/hover-lock";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];
type Props = Extract<Block, { _type: "ad-section" }>;

function isAppScrolling() {
    if (typeof window === "undefined") return false;
    return !!(window as any).__appScrolling;
}

export default function AdSection({
    images,
    orientation,
    title,
    theme,
    padded,
    padding,
    sectionWidth,
    horizontalAlign,
    verticalAlign,
}: Props) {
    const themeActions = useThemeActions();
    const hasTheme = !!(theme?.bg || theme?.text);

    const sectionRef = useRef<HTMLElement | null>(null);

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
        if (typeof document === "undefined") return false;
        const el = sectionRef.current;
        if (!el) return false;

        const pos = getLastMouse();
        if (pos) {
            const hit = document.elementFromPoint(pos.x, pos.y);
            return !!(hit && el.contains(hit));
        }

        return el.matches(":hover");
    }, []);

    useEffect(() => {
        if (typeof window === "undefined" || !hasTheme) return;

        const onScrollEnd = () => {
            if (isHoverLocked()) return;
            if (isPointerInside()) applyTheme(true);
            else clearTheme();
        };

        window.addEventListener(APP_EVENTS.SCROLL_END, onScrollEnd);
        return () => window.removeEventListener(APP_EVENTS.SCROLL_END, onScrollEnd as any);
    }, [applyTheme, clearTheme, hasTheme, isPointerInside]);

    useEffect(() => {
        if (typeof window === "undefined" || !hasTheme) return;

        const onUnlocked = () => {
            if (isPointerInside()) applyTheme(true);
        };

        window.addEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked);
        return () => window.removeEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked as any);
    }, [applyTheme, hasTheme, isPointerInside]);

    const isVertical = orientation === "vertical";

    const sectionWidthClass = useMemo(() => {
        // Mobile: always full width
        // Desktop (md+): respect CMS sectionWidth
        switch (sectionWidth) {
            case "narrow":
                return "w-full md:w-[35vw]";
            case "medium":
                return "w-full md:w-[50vw]";
            case "wide":
                return "w-full md:w-[65vw]";
            case "full":
                return "w-full md:w-screen";
            default:
                return "w-full md:w-[50vw]";
        }
    }, [sectionWidth]);

    const sliderSize = useMemo(() => {
        // feeds hiMaxWidth presets in the slider components
        switch (sectionWidth) {
            case "full":
                return "full" as const;
            case "narrow":
                return "half" as const;
            default:
                return "auto" as const;
        }
    }, [sectionWidth]);

    const hAlignClass = useMemo(() => {
        switch (horizontalAlign) {
            case "center":
                return "justify-center";
            case "right":
                return "justify-end";
            case "left":
            default:
                return "justify-start";
        }
    }, [horizontalAlign]);

    const vAlignClass = useMemo(() => {
        switch (verticalAlign) {
            case "top":
                return "items-start";
            case "bottom":
                return "items-end";
            case "center":
            default:
                return "items-center";
        }
    }, [verticalAlign]);

    const paddingStyle = padded ? { padding: typeof padding === "number" ? padding : 24 } : undefined;

    const sectionStyle: React.CSSProperties = {
        ...(paddingStyle ?? {}),
        containIntrinsicSize: "100vh 50vw",
    };

    const sliderLabel = title ?? "Ad section";

    return (
        <section
            ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
            className={clsx(
                "h-screen flex flex-none relative overflow-hidden will-change-transform transform-gpu",
                sectionWidthClass,
                hAlignClass,
                vAlignClass
            )}
            style={sectionStyle}
            aria-label={sliderLabel}
            data-cursor-blend="normal"
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
            <div className="relative h-full w-full">
                {isVertical ? (
                    <VerticalImageSlider
                        images={imgs ?? []}
                        size={sliderSize}
                        label={sliderLabel}
                        className="h-full w-full"
                    />
                ) : (
                    <HorizontalImageSlider
                        images={imgs ?? []}
                        size={sliderSize}
                        label={sliderLabel}
                        className="h-full w-full"
                    />
                )}
            </div>
        </section>
    );
}
