// components/blocks/hero/hero-contents.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SmoothImage from "@/components/ui/smooth-image";
import BioBlock from "@/components/blocks/hero/bio-block";
import UnderlineLink from "@/components/ui/underline-link";
import { PAGE_QUERYResult } from "@/sanity.types";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useLoader } from "@/components/loader-context";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];
type Props = Extract<Block, { _type: "hero-contents" }>;

type HeroLayout = "feature-left" | "feature-right" | "center-overlay";
type LinksLayoutMode = "custom" | "center" | "two-column";
type IndexActionReason = "hover" | "focus" | "click" | "key";

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

  // overlayImage removed/commented out in schema + query
  // overlayImage?: HeroImage;
};

type HeroItemWithKey = HeroItem & { _key: string };

type RuntimeIndexAction = (
  index: number,
  item: HeroItemWithKey,
  reason: IndexActionReason
) => void;

const BASE_SCALE = 1;
const ACTIVE_SCALE = 1.06;

// Image transition (vertical reveal)
const CLIP_REVEAL = "inset(0% 0% 0% 0%)";
const CLIP_HIDDEN_TOP = "inset(0% 0% 100% 0%)";

const LINKS_GAP_TOP = 16;
const LINKS_GAP_BOTTOM = 16;

function clampPct(n: number | undefined, min = 0, max = 100) {
  return typeof n === "number" ? Math.min(max, Math.max(min, n)) : 50;
}

function normalizeLayout(layout: HeroItem["layout"]): HeroLayout {
  if (layout === "feature-right" || layout === "center-overlay") return layout;
  return "feature-left";
}

function normalizeLinksLayout(mode: unknown): LinksLayoutMode {
  if (mode === "center" || mode === "two-column" || mode === "custom") return mode;
  return "custom";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve();
    const img = new window.Image();
    img.decoding = "async";
    img.src = url;

    const done = () => resolve();

    if ("decode" in img && typeof img.decode === "function") {
      img.decode().then(done).catch(done);
    } else {
      img.onload = done;
      img.onerror = done;
    }
  });
}

function useObservedHeight(ref: React.RefObject<HTMLElement | null>) {
  const [h, setH] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;

    const measure = () => setH(el.offsetHeight || 0);
    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return h;
}

export default function HeroContents(props: Props & { onIndexAction?: RuntimeIndexAction }) {
  const { loaderDone } = useLoader();

  // Robust skip signal: default read + event update (prevents race with loader)
  const [skipInitialEntrance, setSkipInitialEntrance] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!(window as any).__pageEnterSkipInitial;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => setSkipInitialEntrance(!!(window as any).__pageEnterSkipInitial);
    sync();

    const onSkip = () => setSkipInitialEntrance(true);
    window.addEventListener("page-enter-skip-initial", onSkip);

    return () => window.removeEventListener("page-enter-skip-initial", onSkip);
  }, []);

  const shouldRunEntrance = loaderDone && !skipInitialEntrance;

  const showNumbers = !!(props as any)?.showNumbers;
  const linksLayout: LinksLayoutMode = useMemo(
    () => normalizeLinksLayout((props as any)?.linksLayout),
    [props]
  );

  const onIndexAction =
    typeof props.onIndexAction === "function" ? props.onIndexAction : null;

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

  const initialPreviewKey = useMemo(() => {
    const a = initialKey;
    if (a && previewByKey.has(a)) return a;
    return previewables[0]?._key ?? null;
  }, [initialKey, previewByKey, previewables]);

  const [activeKey, setActiveKey] = useState<string | null>(initialKey);
  const [displayedPreviewKey, setDisplayedPreviewKey] = useState<string | null>(
    initialPreviewKey
  );

  // Key being revealed over current (during transition)
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

  // Keep a ref so the transition system isn't relying on stale closure state.
  const displayedPreviewKeyRef = useRef<string | null>(displayedPreviewKey);
  useEffect(() => {
    displayedPreviewKeyRef.current = displayedPreviewKey;
  }, [displayedPreviewKey]);

  const displayedPreviewItem: HeroItemWithKey | null = displayedPreviewKey
    ? previewByKey.get(displayedPreviewKey) ?? null
    : null;

  const pendingItem: HeroItemWithKey | null = pendingKey
    ? previewByKey.get(pendingKey) ?? null
    : null;

  const activeLayout: HeroLayout = normalizeLayout(displayedPreviewItem?.layout);

  const runIndexAction = useCallback(
    (index: number, it: HeroItemWithKey, reason: IndexActionReason) => {
      onIndexAction?.(index, it, reason);
    },
    [onIndexAction]
  );

  const handleActivate = useCallback(
    (it: HeroItemWithKey, index: number, reason: IndexActionReason) => {
      if (!it?._key) return;
      if (it._key === activeKey) return;
      setActiveKey(it._key); // underline / active styles update immediately
      runIndexAction(index, it, reason);
    },
    [activeKey, runIndexAction]
  );

  // Keyboard indexing: 1–9 activates items[0..8], 0 activates item[9]
  useEffect(() => {
    if (!loaderDone) return;
    if (typeof window === "undefined") return;
    if (!keyed.length) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key;
      let idx: number | null = null;

      if (k >= "1" && k <= "9") idx = Number(k) - 1;
      if (k === "0") idx = 9;

      if (idx == null) return;
      if (idx < 0 || idx >= keyed.length) return;

      handleActivate(keyed[idx], idx, "key");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleActivate, keyed, loaderDone]);

  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);

  const headerH = useObservedHeight(headerRef);
  const footerH = useObservedHeight(footerRef);

  const currentLayerRef = useRef<HTMLDivElement | null>(null);
  const nextLayerRef = useRef<HTMLDivElement | null>(null);

  // Transition locking + queueing (last intent wins)
  const isTransitioningRef = useRef(false);
  const queuedKeyRef = useRef<string | null>(null);
  const transitionTlRef = useRef<gsap.core.Timeline | null>(null);

  const displayedImageUrl = displayedPreviewItem?.image?.asset?.url ?? null;
  const pendingImageUrl = pendingItem?.image?.asset?.url ?? null;

  const displayedAlt =
    displayedPreviewItem?.image?.alt ??
    displayedPreviewItem?.title ??
    "Featured image";

  const pendingAlt =
    pendingItem?.image?.alt ?? pendingItem?.title ?? "Next featured image";

  const finishCommitAsync = useCallback(() => {
    return new Promise<void>((resolve) => {
      const nextLayer = nextLayerRef.current;

      if (typeof window === "undefined") {
        setPendingKey(null);
        if (nextLayer) {
          gsap.set(nextLayer, { autoAlpha: 0, clipPath: CLIP_HIDDEN_TOP });
        }
        resolve();
        return;
      }

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
          resolve();
        });
      });
    });
  }, []);

  const renderIndexedTitle = useCallback(
    (title: string, index: number) => {
      if (!showNumbers) return <span className="inline-block">{title}</span>;
      return (
        <>
          <span className="mr-2 inline-block tabular-nums opacity-70">
            {pad2(index + 1)}
          </span>
          <span className="inline-block">{title}</span>
        </>
      );
    },
    [showNumbers]
  );

  // ---------------------------------------
  // IMAGE TRANSITION: solid cycle w/ queue
  // ---------------------------------------
  const startTransition = useCallback(
    async (targetKey: string) => {
      if (!loaderDone) return;
      if (isTransitioningRef.current) return;

      const currentlyDisplayed = displayedPreviewKeyRef.current;
      if (targetKey === currentlyDisplayed) return;

      const nextItem = previewByKey.get(targetKey);

      // If no previewable (no image), just commit and move on.
      if (!nextItem?.image?.asset?.url) {
        isTransitioningRef.current = true;
        setDisplayedPreviewKey(targetKey);
        displayedPreviewKeyRef.current = targetKey;

        await finishCommitAsync();

        isTransitioningRef.current = false;

        const queued = queuedKeyRef.current;
        queuedKeyRef.current = null;

        if (queued && queued !== targetKey && queued !== displayedPreviewKeyRef.current) {
          void startTransition(queued);
        }
        return;
      }

      const nextUrl = nextItem.image.asset.url ?? null;
      const nextLayer = nextLayerRef.current;
      const currentLayer = currentLayerRef.current;

      if (!nextLayer || !currentLayer) {
        setDisplayedPreviewKey(targetKey);
        displayedPreviewKeyRef.current = targetKey;
        return;
      }

      isTransitioningRef.current = true;
      setPendingKey(targetKey);

      try {
        if (nextUrl) await preloadImage(nextUrl);
      } catch {
        // ignore
      }

      if (prefersNoMotionRef.current) {
        setDisplayedPreviewKey(targetKey);
        displayedPreviewKeyRef.current = targetKey;

        await finishCommitAsync();

        isTransitioningRef.current = false;

        const queued = queuedKeyRef.current;
        queuedKeyRef.current = null;

        if (queued && queued !== targetKey && queued !== displayedPreviewKeyRef.current) {
          void startTransition(queued);
        }
        return;
      }

      gsap.killTweensOf([nextLayer, currentLayer]);
      transitionTlRef.current?.kill();
      transitionTlRef.current = null;

      // Prep next layer for reveal
      gsap.set(nextLayer, { autoAlpha: 1, clipPath: CLIP_HIDDEN_TOP });

      const nextMedia = nextLayer.querySelector<HTMLElement>("[data-media]");
      if (nextMedia) {
        gsap.set(nextMedia, { scale: 1.1, transformOrigin: "50% 50%" });
      }

      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: () => {
          setDisplayedPreviewKey(targetKey);
          displayedPreviewKeyRef.current = targetKey;

          void finishCommitAsync().then(() => {
            isTransitioningRef.current = false;
            transitionTlRef.current = null;

            const queued = queuedKeyRef.current;
            queuedKeyRef.current = null;

            if (
              queued &&
              queued !== targetKey &&
              queued !== displayedPreviewKeyRef.current
            ) {
              void startTransition(queued);
            }
          });
        },
      });

      transitionTlRef.current = tl;

      tl.to(nextLayer, { clipPath: CLIP_REVEAL, duration: 0.85 });

      if (nextMedia) {
        tl.to(nextMedia, { scale: 1, duration: 0.85, ease: "power2.out" }, 0);
      }
    },
    [finishCommitAsync, loaderDone, previewByKey]
  );

  // Drive transitions from activeKey with queueing.
  useEffect(() => {
    if (!loaderDone) return;
    if (!activeKey) return;

    if (isTransitioningRef.current) {
      queuedKeyRef.current = activeKey;
      return;
    }

    void startTransition(activeKey);
  }, [activeKey, loaderDone, startTransition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      transitionTlRef.current?.kill();
      transitionTlRef.current = null;
    };
  }, []);

  // Entrance animation (NO clearProps snap, and skipped reliably during loader reveal)
  useGSAP(
    () => {
      const left = leftRef.current;
      const right = rightRef.current;
      const nextLayer = nextLayerRef.current;

      if (!left || !right || !nextLayer) return;
      if (typeof window === "undefined") return;

      const prefersReduced =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // If loader reveal is active OR reduced motion: force final states.
      if (!shouldRunEntrance || prefersReduced) {
        gsap.set(left, { autoAlpha: 1 });
        gsap.set(right, { autoAlpha: 1, y: 0 });
        gsap.set(nextLayer, { autoAlpha: 0, clipPath: CLIP_HIDDEN_TOP });
        return;
      }

      gsap.set(left, { autoAlpha: 1 });
      gsap.set(right, { autoAlpha: 0, y: 30 });
      gsap.set(nextLayer, { autoAlpha: 0, clipPath: CLIP_HIDDEN_TOP });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(right, { autoAlpha: 1, y: 0, duration: 0.8 });

      return () => tl.kill();
    },
    { dependencies: [shouldRunEntrance] }
  );

  const renderLinksCustom = useCallback(() => {
    return (
      <>
        {keyed.map((it, index) => {
          const left = clampPct(it.x);
          const top = clampPct(it.y);
          const isActive = it._key === activeKey;
          const scale = isActive ? ACTIVE_SCALE : BASE_SCALE;

          return (
            <div
              key={it._key}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%`, top: `${top}%` }}
              onMouseEnter={() => handleActivate(it, index, "hover")}
              onFocus={() => handleActivate(it, index, "focus")}
              data-index={index}
            >
              <UnderlineLink
                href={it.slug ? `/projects/${it.slug}` : "#"}
                active={isActive}
                className={[
                  "py-1 px-2 text-lg md:text-xl font-serif font-normal tracking-tighter",
                  "transform-gpu origin-center transition-transform duration-200",
                  !isActive && "hover:scale-[1.08]",
                  isActive ? "opacity-100" : "opacity-70 hover:opacity-100",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ transform: `scale(${scale})` }}
                aria-current={isActive ? "true" : undefined}
                data-cursor="link"
                data-index={index}
                onClick={() => runIndexAction(index, it, "click")}
              >
                {renderIndexedTitle(it.title ?? "Untitled", index)}
              </UnderlineLink>
            </div>
          );
        })}
      </>
    );
  }, [activeKey, handleActivate, keyed, renderIndexedTitle, runIndexAction]);

  const renderLinksList = useCallback(() => {
    if (linksLayout === "center") {
      return (
        <div className="w-full h-full grid place-items-center pointer-events-auto">
          <div className="flex flex-col items-center text-center gap-1">
            {keyed.map((it, index) => {
              const isActive = it._key === activeKey;
              return (
                <UnderlineLink
                  key={it._key}
                  href={it.slug ? `/projects/${it.slug}` : "#"}
                  active={isActive}
                  className={[
                    "text-lg md:text-xl font-serif tracking-tighter inline-block px-2 py-1",
                    isActive ? "opacity-100" : "opacity-70 hover:opacity-100",
                    !isActive && "hover:scale-[1.03]",
                    "transform-gpu origin-center transition-transform duration-200",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => handleActivate(it, index, "hover")}
                  onFocus={() => handleActivate(it, index, "focus")}
                  onClick={() => runIndexAction(index, it, "click")}
                  aria-current={isActive ? "true" : undefined}
                  data-cursor="link"
                  data-index={index}
                >
                  {renderIndexedTitle(it.title ?? "Untitled", index)}
                </UnderlineLink>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="w-full h-full grid place-items-center pointer-events-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1 place-content-center">
          {keyed.map((it, index) => {
            const isActive = it._key === activeKey;
            return (
              <UnderlineLink
                key={it._key}
                href={it.slug ? `/projects/${it.slug}` : "#"}
                active={isActive}
                className={[
                  "text-lg md:text-xl font-serif tracking-tighter inline-block px-2 py-1",
                  isActive ? "opacity-100" : "opacity-70 hover:opacity-100",
                  !isActive && "hover:scale-[1.03]",
                  "transform-gpu origin-center transition-transform duration-200",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => handleActivate(it, index, "hover")}
                onFocus={() => handleActivate(it, index, "focus")}
                onClick={() => runIndexAction(index, it, "click")}
                aria-current={isActive ? "true" : undefined}
                data-cursor="link"
                data-index={index}
              >
                {renderIndexedTitle(it.title ?? "Untitled", index)}
              </UnderlineLink>
            );
          })}
        </div>
      </div>
    );
  }, [activeKey, handleActivate, keyed, linksLayout, renderIndexedTitle, runIndexAction]);

  const linksTop = Math.max(0, headerH + LINKS_GAP_TOP);
  const linksBottom = Math.max(0, footerH + LINKS_GAP_BOTTOM);

  return (
    <section
      data-fouc
      className="w-screen h-screen grid grid-cols-1 md:grid-cols-2 will-change-transform transform-gpu"
      data-hero-layout={activeLayout}
      data-links-layout={linksLayout}
    >
      {/* LEFT – image */}
      <div
        ref={leftRef}
        className="relative h-[50vh] md:h-full overflow-hidden will-change-transform transform-gpu"
      >
        <div className="relative w-full h-full px-6 py-6 md:px-0 md:py-0">
          <div className="relative w-full h-full overflow-hidden">
            {/* CURRENT LAYER */}
            <div
              ref={currentLayerRef}
              className="absolute inset-0 will-change-transform transform-gpu"
            >
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT – content */}
      <div ref={rightRef} className="relative h-full p-6 md:p-4 overflow-hidden">
        {/* HEADER (measured) */}
        <div ref={headerRef} className="flex w-full justify-between mb-4">
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

        {/* LINKS CANVAS (padded area your % positions map to) */}
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ top: linksTop, bottom: linksBottom }}
        >
          <div className="relative w-full h-full">
            {linksLayout === "custom" ? renderLinksCustom() : renderLinksList()}
          </div>
        </div>

        {/* FOOTER (measured) */}
        <div ref={footerRef} className="absolute left-6 right-10 md:right-12 bottom-6">
          <h4 className="text-sm tracking-tighter font-sans max-w-[33ch] mb-4">
            Carlos is a photographer driven by curiosity for bold commercial ideas. He blends
            clean composition with conceptual thinking, creating images that feel sharp and
            contemporary.
          </h4>

          <div className="w-full h-px bg-current mb-4" />

          <div className="flex justify-between items-end">
            <div className="flex gap-4 text-sm">
              <UnderlineLink
                href="mailto:hello@example.com"
                hoverUnderline
                data-cursor="link"
                className="opacity-90 hover:opacity-100"
              >
                Email Me
              </UnderlineLink>

              <UnderlineLink
                href="https://instagram.com/"
                target="_blank"
                rel="noreferrer"
                hoverUnderline
                data-cursor="link"
                className="opacity-90 hover:opacity-100"
              >
                Instagram
              </UnderlineLink>
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
