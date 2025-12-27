// components/blocks/single-image.tsx
"use client";

import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import SmoothImage from "@/components/ui/smooth-image";
import { predecodeNextImages } from "@/lib/predecode";
import { PROJECT_QUERYResult } from "@/sanity.types";

type Block = NonNullable<NonNullable<PROJECT_QUERYResult>["blocks"]>[number];
type Props = Extract<Block, { _type: "single-image" }>;

export default function SingleImage(props: Props) {
  const { image, title, paddingMode, customPadding, widthMode } = props;

  const sectionRef = useRef<HTMLElement | null>(null);

  const imgUrl = image?.asset?.url ?? "";
  const alt =
    image?.alt ??
    (typeof title === "string" && title.length > 0
      ? title
      : "Project image");

  const imgWidth = image?.asset?.width ?? null;
  const imgHeight = image?.asset?.height ?? null;

  // PADDING: none | default | custom
  const resolvedPadding = useMemo(() => {
    switch (paddingMode) {
      case "none":
        return 0;
      case "custom":
        return typeof customPadding === "number" ? customPadding : 24;
      case "default":
      default:
        return 24;
    }
  }, [paddingMode, customPadding]);

  // WIDTH: auto | small | medium | large
  // For small/medium/large: width-driven (vw).
  // For auto: height-driven (vh) – we compute width from aspect ratio.
  const boxClass = useMemo(() => {
    switch (widthMode) {
      case "small":
        return "w-[35vw] max-w-full";
      case "medium":
        return "w-[50vw] max-w-full";
      case "large":
        return "w-[65vw] max-w-full";
      case "auto":
      default:
        return "max-w-full"; // width comes from inline style
    }
  }, [widthMode]);

  const sizesAttr = useMemo(() => {
    switch (widthMode) {
      case "small":
        return "(max-width: 768px) 100vw, 35vw";
      case "medium":
        return "(max-width: 768px) 100vw, 50vw";
      case "large":
        return "(max-width: 768px) 100vw, 65vw";
      case "auto":
      default:
        // height-driven, but we still hint roughly one viewport height
        return "(max-width: 768px) 100vw, 100vh";
    }
  }, [widthMode]);

  const boxStyle = useMemo<React.CSSProperties>(() => {
    const style: React.CSSProperties = {};

    const paddingPx = resolvedPadding ?? 0;

    if (widthMode === "auto") {
      // full-screen block minus vertical padding
      const heightExpr = `calc(100vh - ${paddingPx * 2}px)`;
      style.height = heightExpr;
      style.maxHeight = heightExpr;

      if (imgWidth && imgHeight) {
        const ratio = imgWidth / imgHeight;
        // width = height * (w/h)
        style.width = `calc(${heightExpr} * ${ratio})`;
      } else {
        // no dimensions: just shrink-to-fit
        style.width = "auto";
      }

      style.maxWidth = "100vw";
    } else {
      // non-auto modes can benefit from aspect-ratio but don't require it
      if (imgWidth && imgHeight) {
        style.aspectRatio = `${imgWidth} / ${imgHeight}`;
      }
    }

    return style;
  }, [imgWidth, imgHeight, widthMode, resolvedPadding]);

  const objectFit: "cover" | "contain" =
    widthMode === "auto" ? "contain" : "cover";

  // Pre-decode image as section approaches viewport
  useEffect(() => {
    if (typeof window === "undefined" || !sectionRef.current) return;

    const sectionEl = sectionRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          predecodeNextImages(sectionEl, 1);
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

  const sectionStyle: React.CSSProperties = {
    padding: resolvedPadding,
    contentVisibility: "auto",
    contain: "layout paint style",
    containIntrinsicSize: "100vh 50vw",
  };

  const label = title ?? "Project image";

  return (
    <section
      ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
      // fill screen height
      className="h-screen w-screen flex flex-none justify-center items-center relative overflow-hidden will-change-transform"
      style={sectionStyle}
      aria-label={label}
      data-cursor-blend="normal"
    >
      <figure className="relative w-full flex flex-col items-center">
        <div
          className={clsx("relative overflow-hidden", boxClass)}
          style={boxStyle}
        >
          {imgUrl ? (
            <SmoothImage
              src={imgUrl}
              alt={alt}
              sizes={sizesAttr}
              lqipWidth={24}
              loading="lazy"
              objectFit={objectFit}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
              No image
            </div>
          )}
        </div>

        {title ? (
          <figcaption className="mt-2 text-xs md:text-sm tracking-tight font-serif opacity-70 text-center">
            {title}
          </figcaption>
        ) : null}
      </figure>
    </section>
  );
}
