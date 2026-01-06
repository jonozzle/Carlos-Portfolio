// components/blocks/grid/image-text-grid-image-block.tsx
"use client";

import React, { useMemo } from "react";
import SmoothImage from "@/components/ui/smooth-image";
import { PortableText } from "@portabletext/react";
import clsx from "clsx";

type ImageAsset = {
  url?: string | null;
  width?: number | null;
  height?: number | null;
};

type ImageValue =
  | {
    asset?: ImageAsset | null;
    alt?: string | null;
  }
  | null;

type Props = {
  gridColumn: string;
  gridRow: string;
  image?: ImageValue;
  caption?: any[] | null;
  withColorBlock?: boolean | null;
};

export default function ImageTextGridImageBlock({ gridColumn, gridRow, image, caption, withColorBlock }: Props) {
  const imgUrl = image?.asset?.url ?? "";
  const alt = image?.alt ?? "Image";
  const sizes = useMemo(() => "(max-width: 768px) 100vw, 70vw", []);

  const aspect = useMemo(() => {
    const w = image?.asset?.width ?? null;
    const h = image?.asset?.height ?? null;
    if (!w || !h || w <= 0 || h <= 0) return null;
    return `${w}/${h}`;
  }, [image?.asset?.width, image?.asset?.height]);

  return (
    <figure className="relative z-10 w-full md:w-auto px-4 md:px-0" style={{ gridColumn, gridRow }} data-cursor-blend="normal">
      {/* optional color block behind */}
      {withColorBlock ? <div className="absolute -inset-2 md:-inset-3 bg-current/10 -z-10" /> : null}

      {/* Mobile: aspect-based block; Desktop: fill the grid area */}
      <div
        className={clsx(
          "relative w-full overflow-hidden",
          "aspect-[4/3] md:aspect-auto",
          "md:h-full"
        )}
        style={aspect ? ({ ["--it-aspect" as any]: aspect } as React.CSSProperties) : undefined}
      >
        {/* override default aspect if we have real metadata */}
        <div className={clsx("absolute inset-0", aspect ? "aspect-[var(--it-aspect)] md:aspect-auto" : "")} />

        {imgUrl ? (
          <SmoothImage
            src={imgUrl}
            alt={alt}
            fill
            sizes={sizes}
            lqipWidth={24}
            hiMaxWidth={1800}
            loading="lazy"
            objectFit="cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs opacity-60">No image</div>
        )}

        {/* caption overlay */}
        {caption?.length ? (
          <div
            className={clsx(
              "absolute left-3 bottom-3 md:left-4 md:bottom-4",
              "max-w-[70%] md:max-w-[50%] rounded-sm px-2 py-1.5 md:px-3 md:py-2",
              "bg-black/45 text-white"
            )}
          >
            <div className="text-xs md:text-sm font-serif leading-snug tracking-tight">
              <PortableText value={caption} />
            </div>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
