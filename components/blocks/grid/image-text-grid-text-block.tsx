// components/blocks/grid/image-text-grid-text-block.tsx
"use client";

import React, { useMemo } from "react";
import { PortableText } from "@portabletext/react";
import clsx from "clsx";

type Props = {
  gridColumn: string;
  gridRow: string;
  body?: any[] | null;
  dropCap?: boolean | null;
  justifySelf?: "start" | "center" | "end" | null;
  alignSelf?: "start" | "center" | "end" | null;
  presetWidth?: { width: string; minWidth: string } | null;
  mobilePaddingX?: "none" | "sm" | "md" | "lg" | null;
  mobilePaddingY?: "none" | "sm" | "md" | "lg" | null;
};

type StyleCfg = {
  tag: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote";
  className: string;
  lh: number;
  capTop: string;
  capTrimEm: number;
};

function cfgForStyle(styleKey: string): StyleCfg {
  switch (styleKey) {
    case "h1":
      return { tag: "h1", className: "text-4xl md:text-6xl leading-[1.05]", lh: 1.05, capTop: "0.04em", capTrimEm: 0.22 };
    case "h2":
      return { tag: "h2", className: "text-3xl md:text-5xl leading-[1.08]", lh: 1.08, capTop: "0.045em", capTrimEm: 0.23 };
    case "h3":
      return { tag: "h3", className: "text-2xl md:text-4xl leading-[1.12]", lh: 1.12, capTop: "0.05em", capTrimEm: 0.24 };
    case "h4":
      return { tag: "h4", className: "text-xl md:text-3xl leading-[1.18]", lh: 1.18, capTop: "0.055em", capTrimEm: 0.26 };
    case "h5":
      return { tag: "h5", className: "text-lg md:text-2xl leading-[1.22]", lh: 1.22, capTop: "0.06em", capTrimEm: 0.27 };
    case "h6":
      return { tag: "h6", className: "text-base md:text-xl leading-[1.26]", lh: 1.26, capTop: "0.065em", capTrimEm: 0.28 };
    case "blockquote":
      return { tag: "blockquote", className: "text-lg md:text-xl italic leading-[1.4]", lh: 1.4, capTop: "0.07em", capTrimEm: 0.3 };
    case "normal":
    default:
      return { tag: "p", className: "text-base md:text-lg leading-[1.4]", lh: 1.4, capTop: "0.07em", capTrimEm: 0.3 };
  }
}

function mobilePaddingXClass(value: Props["mobilePaddingX"]) {
  switch (value) {
    case "none":
      return "px-0";
    case "sm":
      return "px-6";
    case "lg":
      return "px-16";
    case "md":
    default:
      return "px-10";
  }
}

function mobilePaddingYClass(value: Props["mobilePaddingY"]) {
  switch (value) {
    case "none":
      return "py-0";
    case "sm":
      return "py-6";
    case "lg":
      return "py-16";
    case "md":
    default:
      return "py-10";
  }
}

export default function ImageTextGridTextBlock({
  gridColumn,
  gridRow,
  body,
  dropCap,
  justifySelf,
  alignSelf,
  presetWidth,
  mobilePaddingX,
  mobilePaddingY,
}: Props) {
  const firstBlockKey = useMemo(() => {
    if (!dropCap) return null;
    if (!Array.isArray(body)) return null;
    const first = body.find((b) => b && b._type === "block" && typeof b._key === "string");
    return first?._key ?? null;
  }, [dropCap, body]);

  const components = useMemo(() => {
    return {
      marks: {
        strong: (p: any) => <strong className="font-bold">{p.children}</strong>,
      },
      block: (p: any) => {
        const styleKey = p?.value?.style || "normal";
        const isFirst = !!dropCap && !!firstBlockKey && p?.value?._key === firstBlockKey;
        const cfg = cfgForStyle(styleKey);
        const Tag = cfg.tag as any;

        const className = clsx(
          "it-pt-block font-serif font-normal tracking-tight",
          cfg.className,
          isFirst && "it-dropcap-target"
        );

        const styleVars = isFirst
          ? ({
            ["--lh" as any]: String(cfg.lh),
            ["--cap-top" as any]: cfg.capTop,
            ["--cap-trim" as any]: String(cfg.capTrimEm),
            ["--cap-lines" as any]: "2",
          } as React.CSSProperties)
          : undefined;

        return (
          <Tag className={className} style={styleVars}>
            {p.children}
          </Tag>
        );
      },
    };
  }, [dropCap, firstBlockKey]);

  return (
    <div
      className={clsx(
        "relative z-10 w-full",
        presetWidth ? "md:w-[var(--it-preset-w)] md:min-w-[var(--it-preset-min-w)]" : "md:w-auto"
      )}
      style={{
        gridColumn,
        gridRow,
        justifySelf: justifySelf ?? undefined,
        alignSelf: alignSelf ?? undefined,
        ...(presetWidth
          ? {
              ["--it-preset-w" as any]: presetWidth.width,
              ["--it-preset-min-w" as any]: presetWidth.minWidth,
            }
          : {}),
      }}
    >
      <div className="w-full md:h-full overflow-visible md:overflow-hidden flex items-start">
        <div
          className={clsx(
            "w-full max-w-full it-pt md:p-0",
            mobilePaddingXClass(mobilePaddingX),
            mobilePaddingYClass(mobilePaddingY)
          )}
        >
          {body?.length ? <PortableText value={body} components={components as any} /> : <div className="text-xs opacity-60">No text</div>}
        </div>
      </div>
    </div>
  );
}
