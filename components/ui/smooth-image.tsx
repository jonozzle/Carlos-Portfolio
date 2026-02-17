// components/ui/smooth-image.tsx
"use client";

import { useEffect, useState, type CSSProperties } from "react";
import NextImage, { type ImageProps } from "next/image";
import { lowSrc, highSrc } from "@/lib/img";

type Props = Omit<ImageProps, "placeholder" | "blurDataURL"> & {
  lqipWidth?: number;
  hiMaxWidth?: number;
  hiQuality?: number;
  objectFit?: "cover" | "contain";
  objectPosition?: string;
};

export default function SmoothImage({
  src,
  className = "",
  lqipWidth = 24,
  hiMaxWidth = 1800,
  hiQuality,
  sizes = "100vw",
  loading,
  fetchPriority = "auto",
  priority = false,
  objectFit = "cover",
  objectPosition = "center center",
  ...rest
}: Props) {
  const useLqip = lqipWidth > 0;
  const [loaded, setLoaded] = useState(!useLqip);

  const raw = typeof src === "string" ? src : "";
  const lo = useLqip ? lowSrc(raw, lqipWidth) : "";
  const hi = typeof src === "string" ? highSrc(src, hiMaxWidth, hiQuality) : src;
  const { style: nextImageStyle, ...nextImageRest } = rest;

  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";

  useEffect(() => {
    if (!useLqip) setLoaded(true);
  }, [useLqip]);

  return (
    <div className={`absolute inset-0 ${className}`} style={{ contain: "paint" }}>
      {lo && !loaded ? (
        <img
          src={lo}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full ${fitClass} pointer-events-none select-none transition-opacity duration-300 will-change-transform transform-gpu`}
          style={{
            objectPosition,
          }}
          decoding="async"
        />
      ) : null}

      <NextImage
        {...nextImageRest}
        src={hi}
        sizes={sizes}
        // default to lazy unless caller explicitly sets something
        loading={loading ?? (priority ? "eager" : "lazy")}
        priority={priority}
        fetchPriority={fetchPriority as any}
        className={`${fitClass} transition-opacity duration-300 will-change-transform transform-gpu`}
        style={{ ...(nextImageStyle as CSSProperties), opacity: loaded ? 1 : 0, objectPosition }}
        onLoad={() => setLoaded(true)}
        decoding="async"
        fill={nextImageRest.fill ?? true}
      />

    </div>
  );
}
