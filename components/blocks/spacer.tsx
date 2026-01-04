// components/blocks/spacer.tsx
"use client";

import React, { useMemo } from "react";
import clsx from "clsx";
import { PAGE_QUERYResult } from "@/sanity.types";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];
type Props = Extract<Block, { _type: "spacer" }>;

export default function Spacer(props: Props) {
  const { size } = props;

  const widthClass = useMemo(() => {
    switch (size) {
      case "small":
        // subtle gap
        return "w-[10vw] min-w-[48px] max-w-[160px]";
      case "large":
        // pronounced gap
        return "w-[28vw] min-w-[120px] max-w-[520px]";
      case "medium":
      default:
        // default gap
        return "w-[18vw] min-w-[80px] max-w-[320px]";
    }
  }, [size]);

  return (
    <section
      className={clsx(
        "h-screen flex flex-none items-stretch justify-stretch",
        "relative overflow-hidden will-change-transform transform-gpu",
        widthClass
      )}
      aria-hidden="true"
      data-cursor-blend="normal"
      data-block="spacer"
    >
      <div className="w-full h-full pointer-events-none" />
    </section>
  );
}
