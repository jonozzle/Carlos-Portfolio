// components/blocks/hero/hero-contents-legacy.tsx
"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from "react";
import SmoothImage from "@/components/ui/smooth-image";
import BioBlock from "@/components/blocks/hero/bio-block";
import { PAGE_QUERYResult } from "@/sanity.types";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useLoader } from "@/components/loader/loader-context";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];
type Props = Extract<Block, { _type: "hero-contents" }>;

type HeroLayout = "feature-left" | "feature-right" | "center-overlay";

type HeroImage = {
  asset?: { url?: string | null } | null;
  alt?: string | null;
} | null;

type HeroItem = {
  _key?: string;
  slug?: string | null;
  title?: string | null;
  year?: number | string | null;
  x?: number;
  y?: number;
  layout?: HeroLayout | null;
  image?: HeroImage;
  overlayImage?: HeroImage;
};

type HeroItemWithKey = HeroItem & { _key: string };

const BASE_SCALE = 1;
const ACTIVE_SCALE = 1.06;

// Full rect
const CLIP_OPEN = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
// Collapsed to center
const CLIP_CLOSED_CENTER = "polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)";

function clampPct(n: number | undefined, min = 0, max = 100) {
  return typeof n === "number" ? Math.min(max, Math.max(min, n)) : 50;
}

function normalizeLayout(layout: HeroItem["layout"]): HeroLayout {
  if (layout === "feature-right" || layout === "center-overlay") return layout;
  return "feature-left";
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve();
    const img = new window.Image();
    img.decoding = "async";
    img.src = url;

    const done = () => resolve();

    if ("decode" in img && typeof img.decode === "function") {
      img
        .decode()
        .then(done)
        .catch(done);
    } else {
      img.onload = done;
      img.onerror = done;
    }
  });
}

export default function HeroContents(props: Props) {
  const { loaderDone } = useLoader();

  // RAW ITEMS FROM PROPS
  const items: HeroItem[] = useMemo(() => {
    const raw = ((props as any)?.items ?? []) as unknown[];
    return raw.filter((it): it is HeroItem => !!it && typeof it === "object");
  }, [props]);

  // ENSURE KEYS
  const keyed: HeroItemWithKey[] = useMemo(
    () =>
      items.map((it, i) => {
        const fallback =
          (it.slug as string | undefined) ??
          (it.title as string | undefined) ??
          "item";
        return {
          ...it,
          _key: it._key ?? `${fallback}-${i}`,
        };
      }),
    [items]
  );

  // ONLY ITEMS WITH IMAGES ARE PREVIEWABLE
  const previewables: HeroItemWithKey[] = useMemo(
    () => keyed.filter((i) => !!i.image?.asset?.url),
    [keyed]
  );

  const previewByKey = useMemo(() => {
    const map = new Map<string, HeroItemWithKey>();
    for (const it of previewables) map.set(it._key, it);
    return map;
  }, [previewables]);

  const initialKey = keyed[0]?._key ?? null;
  const initialPreviewKey = previewables[0]?._key ?? null;

  const [activeKey, setActiveKey] = useState<string | null>(initialKey);
  const [displayedPreviewKey, setDisplayedPreviewKey] = useState<string | null>(
    initialPreviewKey
  );

  const prefersNoMotionRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersNoMotionRef.current = mq.matches;

    const listener = (e: MediaQueryListEvent) => {
      prefersNoMotionRef.current = e.matches;
    };

    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  // ✅ FIX: avoid `displayedPreviewKey && ...` returning "" | HeroItemWithKey
  const displayedPreviewItem: HeroItemWithKey | null = useMemo(() => {
    if (!displayedPreviewKey) return null;
    return previewByKey.get(displayedPreviewKey) ?? null;
  }, [displayedPreviewKey, previewByKey]);

  const activeAlt =
    displayedPreviewItem?.image?.alt ??
    displayedPreviewItem?.title ??
    "Featured image";

  const activeLayout: HeroLayout = normalizeLayout(displayedPreviewItem?.layout);

  const handleActivate = useCallback(
    (it: HeroItemWithKey) => {
      if (it._key === activeKey) return;
      setActiveKey(it._key);
    },
    [activeKey]
  );

  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const imageMaskRef = useRef<HTMLDivElement | null>(null);
  const imageTitleRef = useRef<HTMLDivElement | null>(null);
  const fitTitleRef = useRef<HTMLHeadingElement | null>(null);

  const isTransitioningRef = useRef(false);
  const prevPreviewKeyRef = useRef<string | null>(displayedPreviewKey ?? null);

  // ENTRANCE ANIMATION – INITIAL LOAD
  useGSAP(
    () => {
      if (!loaderDone) return;

      const left = leftRef.current;
      const right = rightRef.current;
      const mask = imageMaskRef.current;
      if (!left || !right || !mask) return;
      if (typeof window === "undefined") return;

      const prefersReduced =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReduced) {
        gsap.set([left, right], { autoAlpha: 1, clearProps: "all" });
        return;
      }

      gsap.set(left, { autoAlpha: 1 });
      gsap.set(mask, { clipPath: CLIP_CLOSED_CENTER });

      gsap.set(right, {
        autoAlpha: 0,
        y: 30,
      });

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      tl.to(mask, {
        clipPath: CLIP_OPEN,
        duration: 1,
      });

      tl.to(
        right,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
        },
        "-=0.25"
      );

      return () => {
        tl.kill();
      };
    },
    { dependencies: [loaderDone] }
  );

  /**
   * OUT TRANSITION: when activeKey changes and differs from displayedPreviewKey.
   * - preload next image
   * - chars stagger out
   * - image slide left
   * - hide left panel
   * - setDisplayedPreviewKey(activeKey)
   */
  useEffect(() => {
    if (!loaderDone) return;
    if (!activeKey) return;
    if (activeKey === displayedPreviewKey) return;
    if (isTransitioningRef.current) return;

    const leftPanel = leftRef.current;
    const mask = imageMaskRef.current;
    const titleWrapper = imageTitleRef.current;

    if (!leftPanel || !mask || !titleWrapper) {
      setDisplayedPreviewKey(activeKey);
      return;
    }

    const nextItem = previewByKey.get(activeKey);
    if (!nextItem) {
      setDisplayedPreviewKey(activeKey);
      return;
    }

    const run = async () => {
      isTransitioningRef.current = true;

      const nextUrl = nextItem.image?.asset?.url ?? null;
      const nextOverlayUrl = nextItem.overlayImage?.asset?.url ?? null;

      try {
        if (nextUrl) await preloadImage(nextUrl);
        if (nextOverlayUrl) await preloadImage(nextOverlayUrl);
      } catch {
        // ignore preload error
      }

      const prefersReduced = prefersNoMotionRef.current;

      if (prefersReduced) {
        setDisplayedPreviewKey(activeKey);
        isTransitioningRef.current = false;
        return;
      }

      const charsOut =
        titleWrapper.querySelectorAll<HTMLElement>("[data-char]");

      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => {
          setDisplayedPreviewKey(activeKey);
          isTransitioningRef.current = false;
        },
      });

      // OUT: letters off
      if (charsOut.length) {
        tl.to(charsOut, {
          autoAlpha: 0,
          duration: 0.45,
          stagger: 0.06,
          ease: "power2.in",
        });
      }

      // OUT: image moves fully off to the left
      tl.to(
        mask,
        {
          xPercent: -120,
          autoAlpha: 0.8,
          duration: 0.7,
          ease: "power3.in",
        },
        charsOut.length ? "-=0.1" : undefined
      );

      // Hide left panel to avoid flash when new template mounts
      tl.add(() => {
        gsap.set(leftPanel, { autoAlpha: 0 });
      });
    };

    void run();
  }, [activeKey, displayedPreviewKey, loaderDone, previewByKey]);

  /**
   * IN TRANSITION: when displayedPreviewKey changes (after OUT completes).
   * - image from right
   * - letters stagger in
   */
  useEffect(() => {
    if (!loaderDone) return;
    if (!displayedPreviewKey) return;

    // Skip anim on very first mount
    if (prevPreviewKeyRef.current === null) {
      prevPreviewKeyRef.current = displayedPreviewKey;
      return;
    }

    const leftPanel = leftRef.current;
    const maskNow = imageMaskRef.current;
    const titleNow = imageTitleRef.current;

    if (!leftPanel || !maskNow || !titleNow) {
      prevPreviewKeyRef.current = displayedPreviewKey;
      return;
    }

    const prefersReduced = prefersNoMotionRef.current;
    if (prefersReduced) {
      gsap.set(leftPanel, { autoAlpha: 1 });
      gsap.set(maskNow, { xPercent: 0, autoAlpha: 1 });
      prevPreviewKeyRef.current = displayedPreviewKey;
      return;
    }

    const charsIn = titleNow.querySelectorAll<HTMLElement>("[data-char]");

    // Initial states for IN
    gsap.set(maskNow, { xPercent: 120, autoAlpha: 0 });
    if (charsIn.length) gsap.set(charsIn, { autoAlpha: 0 });

    gsap.set(leftPanel, { autoAlpha: 1 });

    const tl = gsap.timeline({
      defaults: { ease: "power3.out" },
    });

    tl.to(maskNow, {
      xPercent: 0,
      autoAlpha: 1,
      duration: 0.8,
    });

    if (charsIn.length) {
      tl.to(
        charsIn,
        {
          autoAlpha: 1,
          duration: 0.5,
          stagger: 0.06,
        },
        "-=0.3"
      );
    }

    prevPreviewKeyRef.current = displayedPreviewKey;

    return () => {
      tl.kill();
    };
  }, [displayedPreviewKey, loaderDone]);

  const titleText: string =
    (displayedPreviewItem?.title as string | undefined) ?? "Untitled project";
  const titleYear = displayedPreviewItem?.year;

  // MANUAL CHAR SPLITTING – AVOIDS KERNING JUMPS BETWEEN IN/OUT
  const renderTitleChars = (
    className: string,
    extraRef?: React.RefObject<HTMLHeadingElement | null>
  ) => (
    <h3 ref={extraRef} className={className}>
      {titleText.split("").map((ch: string, idx: number) => (
        <span key={idx} data-char className="inline-block will-change-opacity">
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </h3>
  );

  // FIT TITLE TO CONTAINER FOR TEMPLATE 1 – PER ITEM
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const container = imageTitleRef.current;
    const titleEl = fitTitleRef.current;

    if (!container || !titleEl) return;

    // If not on template 1, reset scale and bail
    if (activeLayout !== "feature-left") {
      gsap.set(titleEl, {
        scale: 1,
        transformOrigin: "top center",
        clearProps: "scale",
      });
      return;
    }

    const applyScale = () => {
      if (!container || !titleEl) return;

      // Reset before measuring
      gsap.set(titleEl, { scale: 1, transformOrigin: "top center" });

      const containerWidth = container.clientWidth;
      const titleWidth = titleEl.scrollWidth;
      if (!containerWidth || !titleWidth) return;

      const rawScale = containerWidth / titleWidth;
      const scale = Math.max(0.6, Math.min(rawScale * 0.98, 2));

      gsap.set(titleEl, {
        scale,
        transformOrigin: "top center",
      });
    };

    // Measure on the next frame after DOM updates
    let frameId = window.requestAnimationFrame(applyScale);

    let ro: ResizeObserver | null = null;
    const onResize = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(applyScale);
    };

    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(onResize);
      ro.observe(container);
    } else {
      window.addEventListener("resize", onResize);
    }

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", onResize);
    };
  }, [displayedPreviewKey, activeLayout, titleText]);

  const imageUrl = displayedPreviewItem?.image?.asset?.url ?? null;
  const overlayImageUrl = displayedPreviewItem?.overlayImage?.asset?.url ?? null;
  const overlayAlt = displayedPreviewItem?.overlayImage?.alt ?? activeAlt;

  return (
    <section
      className="w-screen h-screen grid grid-cols-1 md:grid-cols-2"
      data-hero-layout={activeLayout}
    >
      {/* LEFT – image + animated title (all layouts live here) */}
      <div
        ref={leftRef}
        className="relative h-[50vh] md:h-full overflow-hidden"
        style={{ opacity: 0 }}
      >
        {/* LAYOUT 1: FEATURE LEFT – text at top of image, center */}
        {activeLayout === "feature-left" && (
          <div className="relative w-full h-full px-6 py-6 md:px-0 md:py-0">
            <div ref={imageMaskRef} className="relative w-full h-full overflow-hidden">
              {/* Base background image */}
              {imageUrl ? (
                <SmoothImage
                  key={imageUrl}
                  src={imageUrl}
                  alt={activeAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                  fetchPriority="high"
                  lqipWidth={24}
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-sm opacity-60">
                  No preview image
                </div>
              )}

              {/* Title / year on top of base image */}
              <div className="absolute inset-x-0 top-0 flex justify-center z-10">
                <div
                  ref={imageTitleRef}
                  className="pt-6 md:pt-10 px-6 md:px-10 w-full text-center"
                >
                  {renderTitleChars(
                    "inline-block text-[clamp(2rem,4vw,3.2rem)] md:text-[8vw] font-serif font-normal tracking-tight leading-none text-center will-change-transform",
                    fitTitleRef
                  )}
                  {titleYear && (
                    <p className="mt-2 text-[0.7rem] md:text-xs uppercase tracking-[0.2em] opacity-70 text-center">
                      {String(titleYear)}
                    </p>
                  )}
                </div>
              </div>

              {/* Optional overlay image – on top of text */}
              {overlayImageUrl && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                  <SmoothImage
                    key={overlayImageUrl}
                    src={overlayImageUrl}
                    alt={overlayAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                    fetchPriority="high"
                    lqipWidth={24}
                    className="object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* LAYOUT 2: FEATURE RIGHT – full-width text at top, image centered */}
        {activeLayout === "feature-right" && (
          <div className="relative w-full h-full px-6 py-6 md:px-10 md:py-10">
            {/* Full-width hero text at top */}
            <div
              ref={imageTitleRef}
              className="absolute top-6 left-1/2 -translate-x-1/2 w-full px-6 md:px-10 text-center"
            >
              {renderTitleChars(
                "w-full text-[clamp(2.4rem,5vw,3.8rem)] md:text-[clamp(3rem,6vw,5rem)] font-serif font-normal tracking-tight leading-tight text-center"
              )}
              {titleYear && (
                <p className="mt-2 text-[0.7rem] md:text-xs uppercase tracking-[0.2em] opacity-70 text-center">
                  {String(titleYear)}
                </p>
              )}
            </div>

            {/* Centered image */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                ref={imageMaskRef}
                className="relative w-[68%] max-w-[560px] h-[52%] md:h-[55%] overflow-hidden"
              >
                {imageUrl ? (
                  <SmoothImage
                    key={imageUrl}
                    src={imageUrl}
                    alt={activeAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                    fetchPriority="high"
                    lqipWidth={24}
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-sm opacity-60">
                    No preview image
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LAYOUT 3: CENTER OVERLAY – image with centered overlay text */}
        {activeLayout === "center-overlay" && (
          <div className="relative w-full h-full px-6 py-6 md:px-0 md:py-0">
            <div ref={imageMaskRef} className="relative w-full h-full overflow-hidden">
              {imageUrl ? (
                <SmoothImage
                  key={imageUrl}
                  src={imageUrl}
                  alt={activeAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                  fetchPriority="high"
                  lqipWidth={24}
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-sm opacity-60">
                  No preview image
                </div>
              )}

              <div
                ref={imageTitleRef}
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6"
              >
                {renderTitleChars(
                  "text-4xl md:text-6xl font-serif font-bold tracking-tight leading-tight text-center"
                )}
                {titleYear && (
                  <p className="mt-2 text-xs md:text-sm uppercase tracking-[0.12em] opacity-70 text-center">
                    {String(titleYear)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT – static layout; no animation on project change */}
      <div
        ref={rightRef}
        className="relative h-full p-6 md:p-4 overflow-hidden"
        style={{ opacity: 0, transform: "translateY(30px)" }}
      >
        <div className="flex w-full justify-between mb-4">
          <div>
            <h4 className="text-base tracking-tighter">
              <span className="font-bold uppercase">Latest Project:</span>{" "}
              Horny Press Campaign 2025 September
            </h4>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="text-right text-2xl md:text-4xl font-normal leading-none tracking-tighter -mb-1">
              <span data-hero-main-title className="inline-block">
                <BioBlock />
              </span>
            </div>
          </div>
        </div>

        {/* HOTSPOTS */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {keyed.map((it) => {
            const left = clampPct(it.x);
            const top = clampPct(it.y);
            const isActive = it._key === activeKey;
            const scale = isActive ? ACTIVE_SCALE : BASE_SCALE;

            return (
              <div
                key={it._key}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%`, top: `${top}%` }}
                onMouseEnter={() => handleActivate(it)}
                onFocus={() => handleActivate(it)}
              >
                <a
                  href={it.slug ? `/projects/${it.slug}` : "#"}
                  className={[
                    "py-1 px-2 text-lg md:text-xl font-serif font-normal tracking-tighter inline-block",
                    "transform-gpu origin-center transition-transform duration-200",
                    !isActive && "hover:scale-[1.08]",
                    isActive ? "opacity-100" : "opacity-70 hover:opacity-100",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ transform: `scale(${scale})` }}
                  aria-current={isActive ? "true" : undefined}
                  data-cursor="link"
                >
                  {it.title ?? "Untitled"}
                </a>
              </div>
            );
          })}
        </div>

        {/* FOOTER TEXT */}
        <div className="absolute left-6 right-10 md:right-12 bottom-6">
          <h4 className="text-sm tracking-tighter font-sans max-w-[33ch] mb-4">
            Carlos is a photographer driven by curiosity for bold commercial
            ideas. He blends clean composition with conceptual thinking,
            creating images that feel sharp and contemporary.
          </h4>

          <div className="w-full h-px bg-current mb-4" />

          <div className="flex justify-between items-end">
            <div className="flex gap-4 text-sm">
              <a href="mailto:hello@example.com">Email Me</a>
              <a
                href="https://instagram.com/"
                target="_blank"
                rel="noreferrer"
                data-cursor="link"
              >
                Instagram
              </a>
            </div>

            <h2 className="text-xl md:text-base uppercase font-medium tracking-tighter">
              © 2025
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
}
