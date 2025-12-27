// components/ads/ad-section.tsx
"use client";

import type React from "react";
import { useMemo } from "react";
import clsx from "clsx";
import { PAGE_QUERYResult } from "@/sanity.types";
import { type AdvertImage } from "@/components/ads/advert";
import HorizontalImageSlider from "@/components/ads/horizontal-image-slider";
import VerticalImageSlider from "@/components/ads/vertical-image-slider";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];
type Props = Extract<Block, { _type: "ad-section" }>;

export default function AdSection({
    images,
    orientation,
    title,
    theme, // still in schema, just unused here
    padded,
    padding,
    sectionWidth,
    horizontalAlign,
    verticalAlign,
}: Props) {
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
        [images],
    );

    const isVertical = orientation === "vertical";

    const sectionWidthClass = useMemo(() => {
        switch (sectionWidth) {
            case "narrow":
                return "w-[35vw]";
            case "medium":
                return "w-[50vw]";
            case "wide":
                return "w-[65vw]";
            case "full":
                return "w-screen";
            default:
                return "w-[50vw]";
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

    const paddingStyle = padded
        ? { padding: typeof padding === "number" ? padding : 24 }
        : undefined;

    const sectionStyle: React.CSSProperties = {
        ...(paddingStyle ?? {}),
        //contain: "layout paint style",
        containIntrinsicSize: "100vh 50vw",
    };

    const sliderLabel = title ?? "Ad section";

    return (
        <section
            className={clsx(
                "h-screen flex flex-none relative overflow-hidden  will-change-transform transform-gpu",
                sectionWidthClass,
                hAlignClass,
                vAlignClass,
            )}
            style={sectionStyle}
            aria-label={sliderLabel}
            data-cursor-blend="normal"
        >
            {isVertical ? (
                <VerticalImageSlider
                    images={imgs ?? []}
                    size="half"
                    label={sliderLabel}
                />
            ) : (
                <HorizontalImageSlider
                    images={imgs ?? []}
                    size="half"
                    label={sliderLabel}
                />
            )}
        </section>
    );
}
