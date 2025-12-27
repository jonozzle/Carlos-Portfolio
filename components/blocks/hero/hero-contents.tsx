"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SmoothImage from "@/components/ui/smooth-image";
import BioBlock from "@/components/blocks/hero/bio-block";
import { PAGE_QUERYResult } from "@/sanity.types";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useLoader } from "@/components/loader-context";

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

// Vertical reveal for NEXT layer (swipe down)
const CLIP_REVEAL = "inset(0% 0% 0% 0%)";
const CLIP_HIDDEN_TOP = "inset(0% 0% 100% 0%)";

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

  const items: HeroItem[] = useMemo(() => {
    const raw = ((props as any)?.items ?? []) as unknown[];
    return raw.filter((it): it is HeroItem => !!it && typeof it === "object");
  }, [props]);

  const keyed: HeroItemWithKey[] = useMemo(
    () =>
      items.map((it, i) => {
        const fallback =
          (it.slug as string | undefined) ??
          (it.title as string | undefined) ??
          "item";
        return { ...it, _key: it._key ?? `${fallback}-${i}` };
      }),
    [items]
  );

  const previewables: HeroItemWithKey[] = useMemo(
    () => keyed.filter((i) => i.image?.asset?.url),
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

  // Key that is being revealed over the current one (during transition)
  const [pendingKey, setPendingKey] = useState<string | null>(null);

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

  // Track which URLs are already loaded so SmoothImage doesn't re-show LQIP/blur
  const loadedUrlsRef = useRef<Set<string>>(new Set());
  const markLoaded = useCallback((url: string | null) => {
    if (url) loadedUrlsRef.current.add(url);
  }, []);
  const isLoaded = useCallback((url: string | null) => {
    return !!url && loadedUrlsRef.current.has(url);
  }, []);

  const displayedPreviewItem: HeroItemWithKey | null = displayedPreviewKey
    ? previewByKey.get(displayedPreviewKey) ?? null
    : null;

  const pendingItem: HeroItemWithKey | null = pendingKey
    ? previewByKey.get(pendingKey) ?? null
    : null;


  const activeLayout: HeroLayout = normalizeLayout(displayedPreviewItem?.layout);

  const handleActivate = useCallback(
    (it: HeroItemWithKey) => {
      if (!it?._key) return;
      if (it._key === activeKey) return;
      setActiveKey(it._key);
    },
    [activeKey]
  );

  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);

  const currentLayerRef = useRef<HTMLDivElement | null>(null);
  const nextLayerRef = useRef<HTMLDivElement | null>(null);

  const isTransitioningRef = useRef(false);

  const displayedImageUrl = displayedPreviewItem?.image?.asset?.url ?? null;
  const displayedOverlayUrl =
    displayedPreviewItem?.overlayImage?.asset?.url ?? null;

  const pendingImageUrl = pendingItem?.image?.asset?.url ?? null;
  const pendingOverlayUrl = pendingItem?.overlayImage?.asset?.url ?? null;

  const displayedAlt =
    displayedPreviewItem?.image?.alt ??
    displayedPreviewItem?.title ??
    "Featured image";

  const pendingAlt =
    pendingItem?.image?.alt ?? pendingItem?.title ?? "Next featured image";

  // Ensure current displayed URLs are treated as loaded once they exist
  useEffect(() => {
    markLoaded(displayedImageUrl);
    markLoaded(displayedOverlayUrl);
  }, [displayedImageUrl, displayedOverlayUrl, markLoaded]);

  // Helper: wait for React to paint the new "current" image, THEN hide next layer / clear pending.
  const finishCommit = useCallback(() => {
    const nextLayer = nextLayerRef.current;
    if (typeof window === "undefined") {
      setPendingKey(null);
      if (nextLayer) {
        gsap.set(nextLayer, { autoAlpha: 0, clipPath: CLIP_HIDDEN_TOP });
      }
      return;
    }

    // Two RAFs ensures:
    // 1) state commit -> paint
    // 2) layout/paint settle
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (nextLayer) {
          gsap.set(nextLayer, {
            autoAlpha: 0,
            clipPath: CLIP_HIDDEN_TOP,
            clearProps: "clipPath",
          });
        }
        setPendingKey(null);
      });
    });
  }, []);

  // ENTRANCE ANIMATION – INITIAL LOAD
  useGSAP(
    () => {
      if (!loaderDone) return;

      const left = leftRef.current;
      const right = rightRef.current;
      const nextLayer = nextLayerRef.current;

      if (!left || !right || !nextLayer) return;
      if (typeof window === "undefined") return;

      const prefersReduced =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReduced) {
        gsap.set([left, right], { autoAlpha: 1, clearProps: "all" });
        return;
      }

      gsap.set(left, { autoAlpha: 1 });
      gsap.set(right, { autoAlpha: 0, y: 30 });
      gsap.set(nextLayer, { autoAlpha: 0, clipPath: CLIP_HIDDEN_TOP });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(right, { autoAlpha: 1, y: 0, duration: 0.8 });

      return () => tl.kill();
    },
    { dependencies: [loaderDone] }
  );

  // IMAGE TRANSITION
  useEffect(() => {
    if (!loaderDone) return;
    if (!activeKey) return;
    if (activeKey === displayedPreviewKey) return;
    if (isTransitioningRef.current) return;

    const nextItem = previewByKey.get(activeKey);
    if (!nextItem) {
      setDisplayedPreviewKey(activeKey);
      return;
    }

    const nextUrl = nextItem.image?.asset?.url ?? null;
    const nextOverlayUrl = nextItem.overlayImage?.asset?.url ?? null;

    const nextLayer = nextLayerRef.current;
    const currentLayer = currentLayerRef.current;

    if (!nextLayer || !currentLayer) {
      setDisplayedPreviewKey(activeKey);
      return;
    }

    const run = async () => {
      isTransitioningRef.current = true;
      setPendingKey(activeKey);

      try {
        if (nextUrl) await preloadImage(nextUrl);
        if (nextOverlayUrl) await preloadImage(nextOverlayUrl);
      } catch {
        // ignore preload errors
      }

      markLoaded(nextUrl);
      markLoaded(nextOverlayUrl);

      const prefersReduced = prefersNoMotionRef.current;
      if (prefersReduced) {
        setDisplayedPreviewKey(activeKey);
        finishCommit();
        isTransitioningRef.current = false;
        return;
      }

      gsap.killTweensOf([nextLayer, currentLayer]);

      // Prep next layer for reveal
      gsap.set(nextLayer, {
        autoAlpha: 1,
        clipPath: CLIP_HIDDEN_TOP,
      });

      const nextMedia = nextLayer.querySelector<HTMLElement>("[data-media]");
      if (nextMedia) {
        gsap.set(nextMedia, { scale: 1.1, transformOrigin: "50% 50%" });
      }

      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => {
          // IMPORTANT: commit first, keep next layer visible until React paints new current
          setDisplayedPreviewKey(activeKey);
          finishCommit();
          isTransitioningRef.current = false;
        },
      });

      tl.to(nextLayer, { clipPath: CLIP_REVEAL, duration: 0.85 });

      if (nextMedia) {
        tl.to(nextMedia, { scale: 1, duration: 0.85, ease: "power2.out" }, 0);
      }
    };

    void run();
  }, [
    activeKey,
    displayedPreviewKey,
    loaderDone,
    previewByKey,
    markLoaded,
    finishCommit,
  ]);

  return (
    <section
      className="w-screen h-screen grid grid-cols-1 md:grid-cols-2 will-change-transform transform-gpu"
      data-hero-layout={activeLayout}
    >
      {/* LEFT – image only */}
      <div
        ref={leftRef}
        className="relative h-[50vh] md:h-full overflow-hidden will-change-transform transform-gpu"
        style={{ opacity: 0 }}
      >
        <div className="relative w-full h-full px-6 py-6 md:px-0 md:py-0">
          <div className="relative w-full h-full overflow-hidden">
            {/* CURRENT LAYER */}
            <div ref={currentLayerRef} className="absolute inset-0 will-change-transform transform-gpu">
              <div className="absolute inset-0" data-media>
                {displayedImageUrl ? (
                  <SmoothImage
                    src={displayedImageUrl}
                    alt={displayedAlt}
                    lqipWidth={16}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    fetchPriority="high"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-sm opacity-60">
                    No preview image
                  </div>
                )}

                {displayedOverlayUrl && (
                  <div className="absolute inset-0 pointer-events-none">
                    <SmoothImage
                      src={displayedOverlayUrl}
                      alt={displayedAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority
                      fetchPriority="high"
                      className="object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* NEXT LAYER */}
            <div
              ref={nextLayerRef}
              className="absolute inset-0"
              style={{ opacity: 0, clipPath: CLIP_HIDDEN_TOP }}
              aria-hidden="true"
            >
              <div className="absolute inset-0" data-media>
                {pendingImageUrl ? (
                  <SmoothImage
                    src={pendingImageUrl}
                    alt={pendingAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                    fetchPriority="high"

                    className="object-cover"
                  />
                ) : null}

                {pendingOverlayUrl && (
                  <div className="absolute inset-0 pointer-events-none">
                    <SmoothImage
                      src={pendingOverlayUrl}
                      alt={pendingAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority
                      fetchPriority="high"

                      className="object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT – unchanged */}
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
