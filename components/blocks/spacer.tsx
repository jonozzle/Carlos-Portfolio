// src: components/blocks/spacer.tsx
"use client";

import React, { useMemo } from "react";
import clsx from "clsx";
import { PAGE_QUERYResult } from "@/sanity.types";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];
type SpacerSize = "none" | "xs" | "sm" | "md" | "lg" | "xl";
type Props = Extract<Block, { _type: "spacer" }> & {
  desktopSize?: SpacerSize | null;
  mobileSize?: SpacerSize | null;
  size?: "small" | "medium" | "large" | null;
};

function normalizeDesktopSize(desktopSize: SpacerSize | null | undefined, legacySize: Props["size"]): SpacerSize {
  if (desktopSize === "none" || desktopSize === "xs" || desktopSize === "sm" || desktopSize === "md" || desktopSize === "lg" || desktopSize === "xl") {
    return desktopSize;
  }
  if (legacySize === "small") return "sm";
  if (legacySize === "large") return "lg";
  return "md";
}

function normalizeMobileSize(mobileSize: SpacerSize | null | undefined): SpacerSize {
  if (mobileSize === "none" || mobileSize === "xs" || mobileSize === "sm" || mobileSize === "md" || mobileSize === "lg" || mobileSize === "xl") {
    return mobileSize;
  }
  return "none";
}

export default function Spacer({ size, desktopSize, mobileSize }: Props) {
  /**
   * On desktop your spacer is being treated like a flex item, and in many “horizontal rail”
   * setups the parent applies a fixed `flex-basis` to all children (often 0 or 100vw).
   * If `flex-basis` is not `auto`, `width` can effectively get ignored.
   *
   * So we set BOTH width + flex-basis (and force no grow/shrink) at md+.
   */
  const resolvedDesktopSize = normalizeDesktopSize(desktopSize, size);
  const resolvedMobileSize = normalizeMobileSize(mobileSize);

  const desktopClampClass = useMemo(() => {
    switch (resolvedDesktopSize) {
      case "none":
        return "md:w-0 md:basis-0";
      case "xs":
        return "md:w-[clamp(32px,8vw,120px)] md:basis-[clamp(32px,8vw,120px)]";
      case "sm":
        return "md:w-[clamp(48px,12vw,180px)] md:basis-[clamp(48px,12vw,180px)]";
      case "lg":
        return "md:w-[clamp(120px,24vw,420px)] md:basis-[clamp(120px,24vw,420px)]";
      case "xl":
        return "md:w-[clamp(160px,32vw,560px)] md:basis-[clamp(160px,32vw,560px)]";
      case "md":
      default:
        return "md:w-[clamp(80px,18vw,320px)] md:basis-[clamp(80px,18vw,320px)]";
    }
  }, [resolvedDesktopSize]);

  const mobileHeightClass = useMemo(() => {
    switch (resolvedMobileSize) {
      case "xs":
        return "h-[clamp(24px,6vh,80px)]";
      case "sm":
        return "h-[clamp(40px,10vh,140px)]";
      case "md":
        return "h-[clamp(64px,16vh,220px)]";
      case "lg":
        return "h-[clamp(96px,24vh,320px)]";
      case "xl":
        return "h-[clamp(128px,32vh,420px)]";
      case "none":
      default:
        return "h-0";
    }
  }, [resolvedMobileSize]);

  return (
    <section
      className={clsx(
        // As a rail item: never grow/shrink, take the basis we set
        "flex-none shrink-0 grow-0",

        // Basic box
        "relative overflow-hidden",

        // Mobile: full width, zero height (no spacer)
        "w-full",
        mobileHeightClass,

        // Desktop: full viewport height + horizontal spacer width/basis
        "md:h-screen",
        "md:!flex-none md:!shrink-0 md:!grow-0",
        desktopClampClass
      )}
      aria-hidden="true"
      data-cursor-blend="normal"
      data-block="spacer"
    >
      <div className="w-full h-full pointer-events-none" />
    </section>
  );
}
