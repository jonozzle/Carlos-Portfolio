// components/blocks/image-text-grid.tsx
"use client";

import React, { useMemo, useRef } from "react";
import { PAGE_QUERYResult } from "@/sanity.types";
import ImageTextGridImageBlock from "@/components/blocks/grid/image-text-grid-image-block";
import ImageTextGridTextBlock from "@/components/blocks/grid/image-text-grid-text-block";
import SectionScrollLine from "@/components/ui/section-scroll-line";
import clsx from "clsx";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];

// Add recently-added schema fields as optional so TS won’t block you before typegen
type Props = Extract<Block, { _type: "image-text-grid" }> & {
  showScrollLine?: boolean | null;
  paddingMode?: "none" | "sm" | "md" | "lg" | "xl" | null;
  paddingSideOverrides?: string[] | null;
};

type Item = NonNullable<NonNullable<Props["items"]>[number]>;
type ImageItem = Extract<Item, { _type: "image-text-grid-image" }>;
type TextItem = Extract<Item, { _type: "image-text-grid-text" }>;
type PresetX = "left" | "center" | "right";
type PresetY = "top" | "center" | "bottom";
type GridSelfPos = "start" | "center" | "end";
type PresetWidth = "w33" | "w50" | "w66" | "w75" | "w100";

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

function resolvePresetArea(presetX: unknown, presetY: unknown) {
  const x = presetX === "left" || presetX === "center" || presetX === "right" ? (presetX as PresetX) : "center";
  const y = presetY === "top" || presetY === "center" || presetY === "bottom" ? (presetY as PresetY) : "center";

  const justifyByX: Record<PresetX, GridSelfPos> = {
    left: "start",
    center: "center",
    right: "end",
  };

  const alignByY: Record<PresetY, GridSelfPos> = {
    top: "start",
    center: "center",
    bottom: "end",
  };

  return {
    area: resolveArea(
      {
        rowStart: 1,
        rowEnd: 13,
        colStart: 1,
        colEnd: 13,
      },
      { rowStart: 1, rowEnd: 13, colStart: 1, colEnd: 13 }
    ),
    justifySelf: justifyByX[x],
    alignSelf: alignByY[y],
  };
}

function resolvePresetWidth(presetWidth: unknown) {
  const key: PresetWidth =
    presetWidth === "w33" || presetWidth === "w50" || presetWidth === "w66" || presetWidth === "w75" || presetWidth === "w100"
      ? (presetWidth as PresetWidth)
      : "w50";

  const map: Record<PresetWidth, { width: string; minWidth: string }> = {
    w33: { width: "33%", minWidth: "320px" },
    w50: { width: "50%", minWidth: "420px" },
    w66: { width: "66%", minWidth: "520px" },
    w75: { width: "75%", minWidth: "640px" },
    w100: { width: "100%", minWidth: "760px" },
  };

  return map[key];
}

export default function ImageTextGrid(props: Props) {
  const sectionRef = useRef<HTMLElement | null>(null);

  const paddingMode = props.paddingMode ?? "md";
  const paddingSideOverrides = (Array.isArray(props.paddingSideOverrides) ? props.paddingSideOverrides : []).filter((v) =>
    v === "top" || v === "right" || v === "bottom" || v === "left"
  );
  const widthMode = (props.widthMode ?? "medium") as string;
  const showScrollLine = !!props.showScrollLine;

  const paddingClass = useMemo(() => {
    switch (paddingMode) {
      case "none":
        return "p-0";
      case "sm":
        return "p-4 md:p-6 lg:p-8";
      case "md":
        return "p-6 md:p-8 lg:p-10";
      case "lg":
        return "p-8 md:p-24 lg:p-32";
      case "xl":
        return "p-10 md:p-12 lg:p-42";
      default:
        return "p-6 md:p-8 lg:p-10";
    }
  }, [paddingMode]);

  const paddingOverrideClass = useMemo(() => {
    const sideSet = new Set(paddingSideOverrides);
    return clsx(
      sideSet.has("top") && "!pt-0 md:!pt-0 lg:!pt-0",
      sideSet.has("right") && "!pr-0 md:!pr-0 lg:!pr-0",
      sideSet.has("bottom") && "!pb-0 md:!pb-0 lg:!pb-0",
      sideSet.has("left") && "!pl-0 md:!pl-0 lg:!pl-0"
    );
  }, [paddingSideOverrides]);

  const widthCfg = useMemo(() => {
    switch (widthMode) {
      case "xxs":
        return { width: "30vw", minWidth: "320px" };
      case "xs":
        return { width: "40vw", minWidth: "420px" };
      case "half":
        return { width: "50vw", minWidth: "520px" };
      case "small":
        return { width: "60vw", minWidth: "640px" };
      case "xl":
        return { width: "120vw", minWidth: "1080px" };
      case "large":
        return { width: "100vw", minWidth: "960px" };
      case "medium":
      default:
        return { width: "80vw", minWidth: "820px" };
    }
  }, [widthMode]);

  const items = (props.items ?? []).filter(Boolean) as Item[];

  const resolved = useMemo(() => {
    // lightweight fallbacks so it never renders “nothing” if editors haven’t positioned items yet
    const fallbackImage = { rowStart: 2, rowEnd: 11, colStart: 2, colEnd: 9 };
    const fallbackText = { rowStart: 3, rowEnd: 10, colStart: 9, colEnd: 12 };

    return items.map((it, idx) => {
      let area: { gridRow: string; gridColumn: string };
      let justifySelf: GridSelfPos | null = null;
      let alignSelf: GridSelfPos | null = null;
      let presetWidth: { width: string; minWidth: string } | null = null;

      const usePreset = it._type === "image-text-grid-text" && !!(it as any).usePresetPosition;

      if (usePreset) {
        const preset = resolvePresetArea((it as any).presetX, (it as any).presetY);
        area = preset.area;
        justifySelf = preset.justifySelf;
        alignSelf = preset.alignSelf;
        presetWidth = resolvePresetWidth((it as any).presetWidth);
      } else {
        const fallback = it._type === "image-text-grid-text" ? fallbackText : fallbackImage;
        area = resolveArea(
          {
            rowStart: (it as any).rowStart ?? null,
            rowEnd: (it as any).rowEnd ?? null,
            colStart: (it as any).colStart ?? null,
            colEnd: (it as any).colEnd ?? null,
          },
          fallback
        );
      }

      return { it, idx, area, justifySelf, alignSelf, presetWidth };
    });
  }, [items]);

  return (
    <section
      ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
      className={[
        // width
        "mx-auto w-full md:w-[var(--it-width)] md:min-w-[var(--it-min-width)]",
        // layout + sizing
        "relative flex flex-col h-auto md:h-screen",
        // match single-image padding presets
        paddingClass,
        paddingOverrideClass,
        // behavior
        "overflow-visible md:overflow-hidden will-change-transform transform-gpu",
      ].join(" ")}
      style={
        {
          ["--it-width" as any]: widthCfg.width,
          ["--it-min-width" as any]: widthCfg.minWidth,
        } as React.CSSProperties
      }
      aria-label="Image + Text Grid"
      data-cursor-blend="normal"
    >
      <div
        className={clsx(
          // content area should stop above the line when line is enabled
          "min-h-0 flex-1",
          // mobile: stacked blocks; desktop: 12x12 grid
          "flex flex-col md:grid md:grid-cols-12 md:grid-rows-12",
          // spacing
          "gap-8 md:gap-2",
          // reserve line space without changing line's visual placement
          showScrollLine && "md:pb-10"
        )}
      >
        {resolved.length ? (
          resolved.map(({ it, idx, area, justifySelf, alignSelf, presetWidth }) => {
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
                  mobilePaddingX={(item as any).mobilePaddingX ?? null}
                  mobilePaddingY={(item as any).mobilePaddingY ?? null}
                  justifySelf={justifySelf}
                  alignSelf={alignSelf}
                  presetWidth={presetWidth}
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
      </div>

      <SectionScrollLine triggerRef={sectionRef} enabled={showScrollLine} />
    </section>
  );
}
