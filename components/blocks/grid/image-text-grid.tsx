// components/blocks/image-text-grid.tsx
"use client";

import React, { useMemo, useRef } from "react";
import { PAGE_QUERYResult } from "@/sanity.types";
import ImageTextGridImageBlock from "@/components/blocks/grid/image-text-grid-image-block";
import ImageTextGridTextBlock from "@/components/blocks/grid/image-text-grid-text-block";
import SectionScrollLine from "@/components/ui/section-scroll-line";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];

// Add showScrollLine as optional so TS won’t block you before you regen typegen
type Props = Extract<Block, { _type: "image-text-grid" }> & {
  showScrollLine?: boolean | null;
};

type Item = NonNullable<NonNullable<Props["items"]>[number]>;
type ImageItem = Extract<Item, { _type: "image-text-grid-image" }>;
type TextItem = Extract<Item, { _type: "image-text-grid-text" }>;

function clampN(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveArea(
  item: {
    rowStart?: number | null;
    rowEnd?: number | null;
    colStart?: number | null;
    colEnd?: number | null;
  },
  fallback: { rowStart: number; rowEnd: number; colStart: number; colEnd: number }
) {
  let rowStart = typeof item.rowStart === "number" && item.rowStart > 0 ? item.rowStart : fallback.rowStart;
  rowStart = clampN(rowStart, 1, 12);

  let rowEnd = typeof item.rowEnd === "number" && item.rowEnd > rowStart ? item.rowEnd : fallback.rowEnd;
  rowEnd = clampN(rowEnd, rowStart + 1, 13);

  let colStart = typeof item.colStart === "number" && item.colStart > 0 ? item.colStart : fallback.colStart;
  colStart = clampN(colStart, 1, 12);

  let colEnd = typeof item.colEnd === "number" && item.colEnd > colStart ? item.colEnd : fallback.colEnd;
  colEnd = clampN(colEnd, colStart + 1, 13);

  return {
    gridRow: `${rowStart} / ${rowEnd}`,
    gridColumn: `${colStart} / ${colEnd}`,
  };
}

export default function ImageTextGrid(props: Props) {
  const sectionRef = useRef<HTMLElement | null>(null);

  const widthMode = props.widthMode ?? "medium";
  const showScrollLine = !!props.showScrollLine;

  const width = useMemo(() => {
    switch (widthMode) {
      case "small":
        return "60svw";
      case "large":
        return "100svw";
      case "medium":
      default:
        return "80svw";
    }
  }, [widthMode]);

  const items = (props.items ?? []).filter(Boolean) as Item[];

  const resolved = useMemo(() => {
    // lightweight fallbacks so it never renders “nothing” if editors haven’t positioned items yet
    const fallbackImage = { rowStart: 2, rowEnd: 11, colStart: 2, colEnd: 9 };
    const fallbackText = { rowStart: 3, rowEnd: 10, colStart: 9, colEnd: 12 };

    return items.map((it, idx) => {
      const fallback = it._type === "image-text-grid-text" ? fallbackText : fallbackImage;
      const area = resolveArea(
        {
          rowStart: (it as any).rowStart ?? null,
          rowEnd: (it as any).rowEnd ?? null,
          colStart: (it as any).colStart ?? null,
          colEnd: (it as any).colEnd ?? null,
        },
        fallback
      );
      return { it, idx, area };
    });
  }, [items]);

  return (
    <section
      ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
      className={[
        // width
        "mx-auto w-full md:w-[var(--it-width)]",
        // mobile: stacked blocks; desktop: 12x12 grid
        "flex flex-col md:grid md:grid-cols-12 md:grid-rows-12",
        // spacing
        "gap-8 md:gap-2",
        // sizing + padding
        "h-auto md:h-screen p-0 md:p-2",
        // behavior
        "relative overflow-visible md:overflow-hidden will-change-transform transform-gpu",
      ].join(" ")}
      style={{ ["--it-width" as any]: width } as React.CSSProperties}
      aria-label="Image + Text Grid"
      data-cursor-blend="normal"
    >
      {resolved.length ? (
        resolved.map(({ it, idx, area }) => {
          const key = (it as any)?._key ?? `${it._type}-${idx}`;

          if (it._type === "image-text-grid-image") {
            const item = it as ImageItem;
            return (
              <ImageTextGridImageBlock
                key={key}
                gridColumn={area.gridColumn}
                gridRow={area.gridRow}
                image={(item as any).image ?? null}
                caption={(item as any).caption ?? null}
                withColorBlock={(item as any).withColorBlock ?? null}
              />
            );
          }

          if (it._type === "image-text-grid-text") {
            const item = it as TextItem;
            return (
              <ImageTextGridTextBlock
                key={key}
                gridColumn={area.gridColumn}
                gridRow={area.gridRow}
                body={(item as any).body ?? null}
                dropCap={(item as any).dropCap ?? null}
              />
            );
          }

          return null;
        })
      ) : (
        <div className="w-full md:col-span-12 md:row-span-12 grid place-items-center text-xs opacity-60">
          No items
        </div>
      )}

      <SectionScrollLine triggerRef={sectionRef} enabled={showScrollLine} />
    </section>
  );
}
