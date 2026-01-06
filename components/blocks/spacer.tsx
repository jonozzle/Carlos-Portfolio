// components/blocks/spacer.tsx
"use client";

import React, { useMemo } from "react";
import clsx from "clsx";
import { PAGE_QUERYResult } from "@/sanity.types";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];
type Props = Extract<Block, { _type: "spacer" }>;

function mdPrefix(classes: string) {
  return classes
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => `md:${c}`)
    .join(" ");
}

export default function Spacer(props: Props) {
  const { size } = props;

  // Desktop: horizontal spacing (width) inside the horizontal rail
  const desktopWidthClass = useMemo(() => {
    switch (size) {
      case "small":
        return "w-[10vw] min-w-[48px] max-w-[160px]";
      case "large":
        return "w-[28vw] min-w-[120px] max-w-[520px]";
      case "medium":
      default:
        return "w-[18vw] min-w-[80px] max-w-[320px]";
    }
  }, [size]);

  // Mobile: translate the same “desktop width settings” into vertical spacing (height),
  // using the same min/ideal/max numbers so it never becomes a full-screen spacer.
  const mobileHeightClass = useMemo(() => {
    switch (size) {
      case "small":
        return "h-0";
      case "large":
        return "h-0";
      case "medium":
      default:
        return "h-0";
    }
  }, [size]);

  const desktopWidthMd = useMemo(() => mdPrefix(desktopWidthClass), [desktopWidthClass]);

  return (
    <section
      className={clsx(
        // layout + perf
        "flex flex-none items-stretch justify-stretch",
        "relative overflow-hidden will-change-transform transform-gpu",

        // Mobile (<md): full width + clamped height (no h-screen)
        "w-full",
        mobileHeightClass,

        // Desktop (md+): full-viewport height + horizontal width spacer
        "md:h-screen",
        desktopWidthMd
      )}
      aria-hidden="true"
      data-cursor-blend="normal"
      data-block="spacer"
    >
      <div className="w-full h-full pointer-events-none" />
    </section>
  );
}
