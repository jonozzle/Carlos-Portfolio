// components/blocks/hero/hero-contents.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SmoothImage from "@/components/ui/smooth-image";
import BioBlock from "@/components/blocks/hero/bio-block";
import UnderlineLink from "@/components/ui/underline-link";
import { PAGE_QUERYResult } from "@/sanity.types";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useLoader } from "@/components/loader/loader-context";
import type { PageDirection, PageTransitionKind } from "@/lib/transitions/state";
import { saveScrollForPath } from "@/lib/scroll-state";
import { getActiveHomeSection, saveActiveHomeSectionNow } from "@/lib/home-section";
import { lockAppScroll } from "@/lib/scroll-lock";
import { fadeOutPageRoot } from "@/lib/transitions/page-fade";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];
type Props = Extract<Block, { _type: "hero-contents" }>;

type HeroLayout = "feature-left" | "feature-right" | "center-overlay";
type LinksLayoutMode = "custom" | "center" | "two-column";
type BottomLayoutMode = "justified" | "center";
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
};

type HeroItemWithKey = HeroItem & { _key: string };

type RuntimeIndexAction = (
  index: number,
  item: HeroItemWithKey,
  reason: IndexActionReason
) => void;

type FeaturedProject = {
  title?: string | null;
  slug?: string | null;
} | null;

const BASE_SCALE = 1;
const ACTIVE_SCALE = 1.06;

// Image transition (vertical reveal)
const CLIP_REVEAL = "inset(0% 0% 0% 0%)";
const CLIP_HIDDEN_TOP = "inset(0% 0% 100% 0%)";

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

function normalizeBottomLayout(mode: unknown): BottomLayoutMode {
  if (mode === "center" || mode === "justified") return mode;
  return "justified";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function withColon(label: string) {
  const t = (label ?? "").trim();
  if (!t) return "";
  return t.endsWith(":") ? t : `${t}:`;
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

function BottomLine() {
  // matches project-block structure: h-px + faint track + solid line
  return (
    <div className="relative h-px w-full" aria-hidden="true">
      <div className="absolute inset-0 bg-current opacity-10" />
      <div className="absolute inset-0 bg-current opacity-70" />
    </div>
  );
}

function InlineArrow() {
  // Line extends on hover/focus (no bump), head is filled triangle.
  return (
    <span
      className="relative inline-flex items-center w-[34px] h-[12px] -mb-[1px]"
      aria-hidden="true"
    >
      <span
        className={[
          "absolute left-0 top-1/2 -translate-y-1/2",
          "h-px w-[22px] bg-current",
          "origin-left scale-x-[0.65]",
          "transition-transform duration-300 ease-out",
          "group-hover:scale-x-100 group-focus-visible:scale-x-100",
        ].join(" ")}
      />
      <svg
        className="absolute right-0 top-1/2 -translate-y-1/2"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon points="0,1 10,5 0,9" fill="currentColor" />
      </svg>
    </span>
  );
}

export default function HeroContents(props: Props & { onIndexAction?: RuntimeIndexAction }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loaderDone } = useLoader();

  // If this component mounted while the loader was still running, skip the
  // right-column "entrance" tween for this mount (loader already handled reveal).
  const loaderWasActiveOnMountRef = useRef<boolean>(!loaderDone);
  useEffect(() => {
    // Make it sticky: if we ever observe "not done", treat this mount as loader-controlled.
    if (!loaderDone) loaderWasActiveOnMountRef.current = true;
  }, [loaderDone]);

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

  // Only run our entrance if:
  // - loader is done
  // - no explicit skip
  // - AND the loader did NOT control the initial reveal for this mount
  const shouldRunEntrance =
    loaderDone && !skipInitialEntrance && !loaderWasActiveOnMountRef.current;

  const showNumbers = !!(props as any)?.showNumbers;

  const linksLayout: LinksLayoutMode = useMemo(
    () => normalizeLinksLayout((props as any)?.linksLayout),
    [props]
  );

  const showBottomDivider: boolean = !!(props as any)?.showBottomDivider;
  const bottomLayout: BottomLayoutMode = useMemo(
    () => normalizeBottomLayout((props as any)?.bottomLayout),
    [props]
  );
  const showScrollHint: boolean = !!(props as any)?.showScrollHint;

  const featuredLabelRaw: string = (props as any)?.featuredLabel ?? "";
  const featuredLabel = useMemo(() => withColon(featuredLabelRaw), [featuredLabelRaw]);
  const featuredProjectFromSanity: FeaturedProject = (props as any)?.featuredProject ?? null;

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

  // Start aligned so we don’t do an immediate transition on mount.
  const initialActiveKey = initialPreviewKey ?? initialKey;

  const [activeKey, setActiveKey] = useState<string | null>(initialActiveKey);
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

  const currentLayerRef = useRef<HTMLDivElement | null>(null);
  const nextLayerRef = useRef<HTMLDivElement | null>(null);

  // Transition locking + queueing (last intent wins)
  const isTransitioningRef = useRef(false);
  const queuedKeyRef = useRef<string | null>(null);
  const transitionTlRef = useRef<gsap.core.Timeline | null>(null);

  const displayedImageUrl = displayedPreviewItem?.image?.asset?.url ?? null;
  const pendingImageUrl = pendingItem?.image?.asset?.url ?? null;

  const displayedAlt =
    displayedPreviewItem?.image?.alt ?? displayedPreviewItem?.title ?? "Featured image";

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
          <span className="mr-2 inline-block tabular-nums opacity-70">{pad2(index + 1)}</span>
          <span className="inline-block">{title}</span>
        </>
      );
    },
    [showNumbers]
  );

  // ---------------------------------------
  // PAGE TRANSITION (non-hero): fade-out -> theme lock -> push -> PageEnterShell fades in
  // ---------------------------------------
  const NAV_DIRECTION: PageDirection = "down";

  const navigateWithTransition = useCallback(
    (href: string, kind: PageTransitionKind, homeSectionId?: string | null, homeSectionType?: string | null) => {
      (window as any).__pageTransitionPending = {
        direction: NAV_DIRECTION,
        fromPath: pathname,
        kind,
        homeSectionId: homeSectionId ?? null,
        homeSectionType: homeSectionType ?? null,
      };

      router.push(href);
    },
    [pathname, router]
  );

  const handleTransitionClick = useCallback(
    async (e: React.MouseEvent, href: string, afterFade?: () => void) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      const safeHref = (href ?? "").trim();
      if (!safeHref || safeHref === "#") {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      lockAppScroll();

      // Snapshot BEFORE fade
      const activeHome = pathname === "/" ? getActiveHomeSection() : null;
      if (pathname === "/") saveActiveHomeSectionNow();
      else saveScrollForPath(pathname);

      let kind: PageTransitionKind = "simple";
      const isProjectRoute = safeHref.startsWith("/projects/");
      if (pathname === "/" && isProjectRoute && activeHome?.type === "hero-contents") {
        kind = "fadeHero";
      }

      // Fade OUT first (hides any theme locking / hover resets)
      await fadeOutPageRoot({ duration: 0.26 });

      // Theme lock happens while hidden
      afterFade?.();

      navigateWithTransition(safeHref, kind, activeHome?.id ?? null, activeHome?.type ?? null);
    },
    [navigateWithTransition, pathname]
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

            if (queued && queued !== targetKey && queued !== displayedPreviewKeyRef.current) {
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

  useEffect(() => {
    if (!loaderDone) return;
    if (!activeKey) return;

    if (isTransitioningRef.current) {
      queuedKeyRef.current = activeKey;
      return;
    }

    void startTransition(activeKey);
  }, [activeKey, loaderDone, startTransition]);

  useEffect(() => {
    return () => {
      transitionTlRef.current?.kill();
      transitionTlRef.current = null;
    };
  }, []);

  // Entrance: keep it light (no measurements, no observers)
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

      gsap.set(left, { autoAlpha: 1 });
      gsap.set(nextLayer, { autoAlpha: 0, clipPath: CLIP_HIDDEN_TOP });

      // If loader handled reveal (or we must skip), ensure the right is just "there".
      if (!shouldRunEntrance || prefersReduced) {
        gsap.set(right, { autoAlpha: 1, y: 0, clearProps: "willChange" });
        return;
      }

      gsap.set(right, { autoAlpha: 0, y: 24, willChange: "transform,opacity" });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(right, {
        autoAlpha: 1,
        y: 0,
        duration: 0.75,
        onComplete: () => {
          gsap.set(right, { clearProps: "willChange" });
        },
      });

      return () => {
        tl.kill();
        gsap.set(right, { clearProps: "willChange" });
      };
    },
    { dependencies: [shouldRunEntrance] }
  );

  // Scroll hint:
  // - Arrow stays centered over the word.
  // - Only knob you touch is SHAFT_W.
  // - Head auto-aligns to the shaft vertically.
  // - Subtle bump + elastic return.
  const scrollHintArrowRef = useRef<SVGGElement | null>(null);
  const scrollHintTweenRef = useRef<gsap.core.Tween | gsap.core.Timeline | null>(null);

  useEffect(() => {
    scrollHintTweenRef.current?.kill();
    scrollHintTweenRef.current = null;

    const arrow = scrollHintArrowRef.current;
    if (!arrow) return;
    if (!showScrollHint) return;
    if (!loaderDone) return;
    if (typeof window === "undefined") return;

    const prefersReduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    gsap.set(arrow, {
      x: 0,
      y: 0,
      svgOrigin: "27 6", // center of viewBox (0..54, 0..12)
      transformOrigin: "50% 50%",
      willChange: prefersReduced ? "auto" : "transform",
    });

    if (prefersReduced) return;

    const BUMP_PX = 3;

    const tl = gsap.timeline({
      repeat: -1,
      repeatDelay: 1.1,
      defaults: { overwrite: "auto" },
    });

    tl.to(arrow, {
      x: BUMP_PX,
      duration: 0.28,
      ease: "power1.out",
    }).to(arrow, {
      x: 0,
      duration: 0.85,
      ease: "elastic.out(1, 0.5)",
    });

    scrollHintTweenRef.current = tl;

    return () => {
      tl.kill();
      scrollHintTweenRef.current = null;
      gsap.set(arrow, { clearProps: "willChange" });
    };
  }, [loaderDone, showScrollHint]);

  const renderLinksCustom = useCallback(() => {
    return (
      <>
        {keyed.map((it, index) => {
          const left = clampPct(it.x);
          const top = clampPct(it.y);
          const isActive = it._key === activeKey;
          const scale = isActive ? ACTIVE_SCALE : BASE_SCALE;

          const href = it.slug ? `/projects/${it.slug}` : "#";

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
                href={href}
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
                onClick={(e) => {
                  // make it feel “chosen” immediately, but DO NOT run theme lock yet
                  if (it._key !== activeKey) setActiveKey(it._key);

                  handleTransitionClick(e, href, () => runIndexAction(index, it, "click"));
                }}
              >
                {renderIndexedTitle(it.title ?? "Untitled", index)}
              </UnderlineLink>
            </div>
          );
        })}
      </>
    );
  }, [
    activeKey,
    handleActivate,
    handleTransitionClick,
    keyed,
    renderIndexedTitle,
    runIndexAction,
  ]);

  const renderLinksList = useCallback(() => {
    if (linksLayout === "center") {
      return (
        <div className="w-full h-full grid place-items-center pointer-events-auto">
          <div className="flex flex-col items-center text-center gap-1">
            {keyed.map((it, index) => {
              const isActive = it._key === activeKey;
              const href = it.slug ? `/projects/${it.slug}` : "#";

              return (
                <UnderlineLink
                  key={it._key}
                  href={href}
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
                  onClick={(e) => {
                    if (it._key !== activeKey) setActiveKey(it._key);
                    handleTransitionClick(e, href, () => runIndexAction(index, it, "click"));
                  }}
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
            const href = it.slug ? `/projects/${it.slug}` : "#";

            return (
              <UnderlineLink
                key={it._key}
                href={href}
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
                onClick={(e) => {
                  if (it._key !== activeKey) setActiveKey(it._key);
                  handleTransitionClick(e, href, () => runIndexAction(index, it, "click"));
                }}
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
  }, [
    activeKey,
    handleActivate,
    handleTransitionClick,
    keyed,
    linksLayout,
    renderIndexedTitle,
    runIndexAction,
  ]);

  // Featured project fallback: if no explicit featured project, use first hero item.
  const featuredResolved = useMemo(() => {
    const selected = featuredProjectFromSanity;
    if (selected?.slug && selected?.title) return selected;

    const first = keyed[0];
    if (first?.slug && first?.title) return { title: first.title, slug: first.slug };

    return null;
  }, [featuredProjectFromSanity, keyed]);

  // If featured slug matches a hero item, use it for click theme lock.
  const featuredMatch = useMemo(() => {
    const slug = featuredResolved?.slug ?? null;
    if (!slug) return null;

    const idx = keyed.findIndex((k) => (k.slug ?? "") === slug);
    if (idx < 0) return null;

    return { idx, item: keyed[idx] };
  }, [featuredResolved?.slug, keyed]);

  const shouldShowFeatured = !!(featuredLabel && featuredResolved?.slug && featuredResolved?.title);

  // ---- Arrow config (minimal) ----
  // Only change this:
  const SHAFT_W = 20;

  // Everything else is hard-coded / derived:
  const VIEW_W = 54;
  const SHAFT_Y = 5;
  const SHAFT_H = 1;
  const SHAFT_CY = SHAFT_Y + SHAFT_H / 2;

  // Head shape is your notched polygon, scaled up:
  const HEAD_SCALE = 2;
  const HEAD_CENTER_Y = 2.03; // from polygon, where it "centers"
  const HEAD_TIP_X = 4.97; // max x of polygon
  const HEAD_W = HEAD_SCALE * HEAD_TIP_X;

  // Place head so its center aligns to shaft center
  const HEAD_Y = SHAFT_CY - HEAD_CENTER_Y * HEAD_SCALE;

  // Place head immediately after shaft
  const HEAD_X = SHAFT_W;

  // Now center the whole (shaft + head) inside viewBox
  const TOTAL_W = SHAFT_W + HEAD_W;
  const OFFSET_X = (VIEW_W - TOTAL_W) / 2;

  return (
    <section
      data-fouc
      data-hero-layout={activeLayout}
      data-links-layout={linksLayout}
      className="relative flex-none w-screen h-auto md:h-screen grid grid-cols-1 md:grid-cols-2"
      style={{ contain: "layout paint" }}
    >
      {/* LEFT – image */}
      <div ref={leftRef} className="relative h-[60vh] md:h-full overflow-hidden">
        <div className="absolute right-3 top-3 z-30 md:hidden">
          <span data-hero-main-title className="block">
            <BioBlock />
          </span>
        </div>
        <div className="relative w-full h-full px-6 py-6 md:px-0 md:py-0">
          <div className="relative w-full h-full overflow-hidden">
            {/* CURRENT LAYER */}
            <div ref={currentLayerRef} className="absolute inset-0">
              <div className="absolute inset-0 transform-gpu" data-media>
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
              <div className="absolute inset-0 transform-gpu" data-media>
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
      <div
        ref={rightRef}
        className="relative h-full px-6 pt-6 pb-2 overflow-hidden flex flex-col"
        style={{ contain: "layout paint" }}
      >
        {/* HEADER (BioBlock is absolute on desktop so it never reflows links) */}
        <div className="relative flex-none mb-0 md:mb-4 min-h-0 md:min-h-[64px]">
          <div className="pr-0 md:pr-[320px]">
            {shouldShowFeatured ? (
              <div className="text-base tracking-tighter flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-bold uppercase">{featuredLabel}</span>

                <UnderlineLink
                  href={`/projects/${featuredResolved!.slug}`}
                  hoverUnderline
                  className="group inline-flex items-baseline gap-2"
                  data-cursor="link"
                  onClick={(e) => {
                    const href = `/projects/${featuredResolved!.slug}`;

                    // If we can map it to a hero item, lock theme after fade.
                    if (featuredMatch) {
                      handleTransitionClick(e, href, () =>
                        runIndexAction(featuredMatch.idx, featuredMatch.item, "click")
                      );
                      return;
                    }

                    handleTransitionClick(e, href);
                  }}
                >
                  <span className="inline-flex items-baseline gap-2">
                    <span className="font-serif tracking-tighter">{featuredResolved!.title}</span>
                    <InlineArrow />
                  </span>
                </UnderlineLink>
              </div>
            ) : null}
          </div>

          <div className="absolute right-0 top-0 z-30 hidden md:block">
            <span data-hero-main-title className="block">
              <BioBlock />
            </span>
          </div>
        </div>

        {/* LINKS FIELD */}
        <div className="relative flex-1 pointer-events-none">
          <div className="relative w-full h-full">
            {linksLayout === "custom" ? renderLinksCustom() : renderLinksList()}
          </div>
        </div>

        {/* FOOTER */}
        <div className="relative flex-none">
          <h4 className="text-sm tracking-tighter font-sans max-w-[33ch] mb-4">
            Carlos is a photographer driven by curiosity for bold commercial ideas. He blends
            clean composition with conceptual thinking, creating images that feel sharp and
            contemporary.
          </h4>

          {showBottomDivider ? <BottomLine /> : null}

          {bottomLayout === "center" ? (
            <div className="mt-4 flex flex-col items-center text-center gap-3">
              <div className="flex items-center justify-center gap-6 text-sm pointer-events-auto">
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

              <h2 className="text-base uppercase font-medium tracking-tighter opacity-90">© 2025</h2>
            </div>
          ) : (
            <div className="mt-2 flex justify-between items-end">
              <div className="flex gap-4 text-sm pointer-events-auto">
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

              <h2 className="text-xl md:text-base uppercase font-medium tracking-tighter">© 2025</h2>
            </div>
          )}
        </div>

        {/* scroll hint (center vertically, right edge) */}
        {showScrollHint && loaderDone ? (
          <div
            className="hidden md:block pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 z-20"
            aria-hidden="true"
          >
            <div className="flex flex-col items-center gap-2">
              <svg
                width="54"
                height="12"
                viewBox="0 0 54 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="block opacity-25"
              >
                <g ref={scrollHintArrowRef}>
                  {/* Shaft */}
                  <rect
                    x={OFFSET_X}
                    y={SHAFT_Y}
                    width={SHAFT_W}
                    height={SHAFT_H}
                    rx="1"
                    fill="currentColor"
                  />

                  {/* Head (auto-aligned to shaft center) */}
                  <g transform={`translate(${OFFSET_X + HEAD_X} ${HEAD_Y}) scale(${HEAD_SCALE})`}>
                    <polygon
                      points="4.97 2.03 0 4.06 1.18 2.03 0 0 4.97 2.03"
                      fill="currentColor"
                    />
                  </g>
                </g>
              </svg>

              <div className="text-[10px] uppercase tracking-tight opacity-25 font-serif">
                scroll
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
