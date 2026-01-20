// src: components/blocks/spacer.tsx
"use client";

import React, { useMemo } from "react";
import clsx from "clsx";
import { PAGE_QUERYResult } from "@/sanity.types";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];
type Props = Extract<Block, { _type: "spacer" }>;

export default function Spacer({ size }: Props) {
  /**
   * On desktop your spacer is being treated like a flex item, and in many “horizontal rail”
   * setups the parent applies a fixed `flex-basis` to all children (often 0 or 100vw).
   * If `flex-basis` is not `auto`, `width` can effectively get ignored.
   *
   * So we set BOTH width + flex-basis (and force no grow/shrink) at md+.
   */
  const desktopClampClass = useMemo(() => {
    switch (size) {
      case "small":
        return "md:w-[clamp(48px,10vw,160px)] md:basis-[clamp(48px,10vw,160px)]";
      case "large":
        return "md:w-[clamp(120px,28vw,520px)] md:basis-[clamp(120px,28vw,520px)]";
      case "medium":
      default:
        return "md:w-[clamp(80px,18vw,320px)] md:basis-[clamp(80px,18vw,320px)]";
    }
  }, [size]);

  // If you truly want no spacer effect on mobile, keep it at 0 height.
  const mobileHeightClass = useMemo(() => "h-0", []);

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
