// components/ui/smooth-image.tsx
"use client";

import { useState } from "react";
import NextImage, { type ImageProps } from "next/image";
import { lowSrc, highSrc } from "@/lib/img";

type Props = Omit<ImageProps, "placeholder" | "blurDataURL"> & {
  lqipWidth?: number;
  hiMaxWidth?: number;
  objectFit?: "cover" | "contain";
};

export default function SmoothImage({
  src,
  className = "",
  lqipWidth = 24,
  hiMaxWidth = 1800,
  sizes = "100vw",
  loading,
  fetchPriority = "auto",
  priority = false,
  objectFit = "cover",
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);

  const raw = typeof src === "string" ? src : "";
  const lo = lowSrc(raw, lqipWidth);
  const hi = typeof src === "string" ? highSrc(src, hiMaxWidth) : src;

  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";

  return (
    <div className={`absolute inset-0 ${className}`} style={{ contain: "paint" }}>
      {lo ? (
        <img
          src={lo}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full ${fitClass} pointer-events-none select-none transition-opacity duration-300 will-change-transform transform-gpu`}
          style={{

            opacity: loaded ? 0 : 1,
          }}
          decoding="async"
        />
      ) : null}

      <NextImage
        {...rest}
        src={hi}
        sizes={sizes}
        // default to lazy unless caller explicitly sets something
        loading={loading ?? (priority ? "eager" : "lazy")}
        priority={priority}
        fetchPriority={fetchPriority as any}
        className={`${fitClass} transition-opacity duration-300 will-change-transform transform-gpu`}
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
        decoding="async"
        fill={rest.fill ?? true}
      />

    </div>
  );
}
