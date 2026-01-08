// components/blocks/hero/hero-contents.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SmoothImage from "@/components/ui/smooth-image";
import BioBlock from "@/components/blocks/hero/bio-block";
import UnderlineLink from "@/components/ui/underline-link";
import HeroUnderlineLink, {
  HERO_LINK_FONT_DURATION,
  HERO_LINK_UNDERLINE_OUT_DURATION,
  HERO_LINK_WEIGHT_FADE_DURATION,
} from "@/components/ui/hero-underline-link";
import { PAGE_QUERYResult } from "@/sanity.types";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useLoader } from "@/components/loader/loader-context";
import type { PageDirection, PageTransitionKind } from "@/lib/transitions/state";
import { saveScrollForPath } from "@/lib/scroll-state";
import { getActiveHomeSection, saveActiveHomeSectionNow } from "@/lib/home-section";
import { lockAppScroll } from "@/lib/scroll-lock";
import { fadeOutPageRoot } from "@/lib/transitions/page-fade";
import { PortableText } from "@portabletext/react";
import clsx from "clsx";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

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

type HeroLink = {
  _key?: string;
  label?: string | null;
  href?: string | null;
  newTab?: boolean | null;
};

type BioSection = {
  body?: any[] | null;
  dropCap?: boolean | null;
  links?: HeroLink[] | null;
} | null;

// Image transition (vertical reveal)
const CLIP_REVEAL = "inset(0% 0% 0% 0%)";
const CLIP_HIDDEN_TOP = "inset(0% 0% 100% 0%)";
const HERO_ACTIVE_SWAP_BUFFER = 0.08;
const HERO_ACTIVE_SWAP_DELAY =
  HERO_LINK_UNDERLINE_OUT_DURATION +
  HERO_LINK_FONT_DURATION +
  HERO_LINK_WEIGHT_FADE_DURATION +
  HERO_ACTIVE_SWAP_BUFFER;

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
  return (
    <div className="relative h-px w-full" aria-hidden="true">
      <div className="absolute inset-0 bg-current opacity-10" />
      <div className="absolute inset-0 bg-current opacity-70" />
    </div>
  );
}

function InlineArrow() {
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

type StyleCfg = {
  tag: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote";
  className: string;
  lh: number;
  capTop: string;
  capTrimEm: number;
};

function cfgForStyle(styleKey: string, variant: "bio" | "footer"): StyleCfg {
  const baseNormal =
    variant === "footer"
      ? { className: "text-sm leading-[1.4]", lh: 1.4, capTop: "0.07em", capTrimEm: 0.3 }
      : {
        className: "text-sm md:text-base leading-[1.45]",
        lh: 1.45,
        capTop: "0.07em",
        capTrimEm: 0.3,
      };

  switch (styleKey) {
    case "h1":
      return {
        tag: "h1",
        className: "text-3xl md:text-5xl leading-[1.05]",
        lh: 1.05,
        capTop: "0.04em",
        capTrimEm: 0.22,
      };
    case "h2":
      return {
        tag: "h2",
        className: "text-2xl md:text-4xl leading-[1.08]",
        lh: 1.08,
        capTop: "0.045em",
        capTrimEm: 0.23,
      };
    case "h3":
      return {
        tag: "h3",
        className: "text-xl md:text-3xl leading-[1.12]",
        lh: 1.12,
        capTop: "0.05em",
        capTrimEm: 0.24,
      };
    case "h4":
      return {
        tag: "h4",
        className: "text-lg md:text-2xl leading-[1.18]",
        lh: 1.18,
        capTop: "0.055em",
        capTrimEm: 0.26,
      };
    case "h5":
      return {
        tag: "h5",
        className: "text-base md:text-xl leading-[1.22]",
        lh: 1.22,
        capTop: "0.06em",
        capTrimEm: 0.27,
      };
    case "h6":
      return {
        tag: "h6",
        className: "text-sm md:text-lg leading-[1.26]",
        lh: 1.26,
        capTop: "0.065em",
        capTrimEm: 0.28,
      };
    case "blockquote":
      return {
        tag: "blockquote",
        className: "text-sm md:text-base italic leading-[1.4]",
        lh: 1.4,
        capTop: "0.07em",
        capTrimEm: 0.3,
      };
    case "normal":
    default:
      return { tag: "p", ...baseNormal };
  }
}

function isLikelyExternal(href: string) {
  const h = (href ?? "").trim();
  return h.startsWith("http://") || h.startsWith("https://");
}

function sanitizeHref(href: unknown) {
  const h = typeof href === "string" ? href.trim() : "";
  return h || null;
}

function HeroPortableText({
  value,
  dropCap,
  variant,
  className,
  maxWidthClassName,
}: {
  value?: any[] | null;
  dropCap?: boolean | null;
  variant: "bio" | "footer";
  className?: string;
  maxWidthClassName?: string;
}) {
  const firstBlockKey = useMemo(() => {
    if (!dropCap) return null;
    if (!Array.isArray(value)) return null;
    const first = value.find((b) => b && b._type === "block" && typeof b._key === "string");
    return first?._key ?? null;
  }, [dropCap, value]);

  const components = useMemo(() => {
    return {
      marks: {
        strong: (p: any) => <strong className="font-bold">{p.children}</strong>,
        em: (p: any) => <em className="italic">{p.children}</em>,
      },
      block: (p: any) => {
        const styleKey = p?.value?.style || "normal";
        const isFirst = !!dropCap && !!firstBlockKey && p?.value?._key === firstBlockKey;

        const cfg = cfgForStyle(styleKey, variant);
        const Tag = cfg.tag as any;

        const tagClassName = clsx(
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
          <Tag className={tagClassName} style={styleVars}>
            {p.children}
          </Tag>
        );
      },
    };
  }, [dropCap, firstBlockKey, variant]);

  if (!value?.length) return null;

  return (
    <div className={clsx("it-pt", maxWidthClassName, className)}>
      <PortableText value={value} components={components as any} />
    </div>
  );
}

export default function HeroContents(props: Props & { onIndexAction?: RuntimeIndexAction }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loaderDone } = useLoader();

  const containerRef = useRef<HTMLElement | null>(null);

  // If this component mounted while the loader was still running, skip the
  // right-column "entrance" tween for this mount (loader already handled reveal).
  const loaderWasActiveOnMountRef = useRef<boolean>(!loaderDone);
  useEffect(() => {
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

  const shouldRunEntrance = loaderDone && !skipInitialEntrance && !loaderWasActiveOnMountRef.current;

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

  const onIndexAction = typeof props.onIndexAction === "function" ? props.onIndexAction : null;

  const items: HeroItem[] = useMemo(() => {
    const raw = ((props as any)?.items ?? []) as unknown[];
    return raw.filter((it): it is HeroItem => !!it && typeof it === "object");
  }, [props]);

  const keyed: HeroItemWithKey[] = useMemo(
    () =>
      items.map((it, i) => {
        const fallback =
          (it.slug as string | undefined) ?? (it.title as string | undefined) ?? "item";
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

  const initialActiveKey = initialPreviewKey ?? initialKey;

  const [activeKey, setActiveKey] = useState<string | null>(initialActiveKey);
  const [displayedPreviewKey, setDisplayedPreviewKey] = useState<string | null>(initialPreviewKey);
  const activeKeyRef = useRef<string | null>(activeKey);

  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const pendingActivationRef = useRef<{ key: string; onActivate?: () => void } | null>(null);
  const activeSwapTlRef = useRef<gsap.core.Timeline | null>(null);

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

  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  const displayedPreviewKeyRef = useRef<string | null>(displayedPreviewKey);
  useEffect(() => {
    displayedPreviewKeyRef.current = displayedPreviewKey;
  }, [displayedPreviewKey]);

  const displayedPreviewItem: HeroItemWithKey | null = displayedPreviewKey
    ? previewByKey.get(displayedPreviewKey) ?? null
    : null;

  const pendingItem: HeroItemWithKey | null = pendingKey ? previewByKey.get(pendingKey) ?? null : null;

  const activeLayout: HeroLayout = normalizeLayout(displayedPreviewItem?.layout);

  const runIndexAction = useCallback(
    (index: number, it: HeroItemWithKey, reason: IndexActionReason) => {
      onIndexAction?.(index, it, reason);
    },
    [onIndexAction]
  );

  const activateHeroLink = useCallback(
    (nextKey: string, onActivate?: () => void, immediate = false) => {
      if (!nextKey) return;
      if (nextKey === activeKeyRef.current && !activeSwapTlRef.current) return;

      if (immediate || prefersNoMotionRef.current) {
        activeSwapTlRef.current?.kill();
        activeSwapTlRef.current = null;
        pendingActivationRef.current = null;
        setActiveKey(nextKey);
        onActivate?.();
        return;
      }

      pendingActivationRef.current = { key: nextKey, onActivate };

      if (activeSwapTlRef.current) return;

      if (!activeKeyRef.current) {
        const pending = pendingActivationRef.current;
        pendingActivationRef.current = null;
        if (pending) {
          setActiveKey(pending.key);
          pending.onActivate?.();
        }
        return;
      }

      setActiveKey(null);

      const tl = gsap.timeline({
        defaults: { overwrite: "auto" },
        onComplete: () => {
          activeSwapTlRef.current = null;
          const pending = pendingActivationRef.current;
          pendingActivationRef.current = null;
          if (pending) {
            setActiveKey(pending.key);
            pending.onActivate?.();
          }
        },
      });

      tl.to({}, { duration: HERO_ACTIVE_SWAP_DELAY });

      activeSwapTlRef.current = tl;
    },
    []
  );

  const handleActivate = useCallback(
    (it: HeroItemWithKey, index: number, reason: IndexActionReason) => {
      if (!it?._key) return;
      activateHeroLink(it._key, () => runIndexAction(index, it, reason));
    },
    [activateHeroLink, runIndexAction]
  );

  useEffect(() => {
    return () => {
      activeSwapTlRef.current?.kill();
      activeSwapTlRef.current = null;
    };
  }, []);

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

  const footerRef = useRef<HTMLDivElement | null>(null);
  const scrollHintWrapRef = useRef<HTMLDivElement | null>(null);

  const isTransitioningRef = useRef(false);
  const queuedKeyRef = useRef<string | null>(null);
  const transitionTlRef = useRef<gsap.core.Timeline | null>(null);

  const displayedImageUrl = displayedPreviewItem?.image?.asset?.url ?? null;
  const pendingImageUrl = pendingItem?.image?.asset?.url ?? null;

  const displayedAlt = displayedPreviewItem?.image?.alt ?? displayedPreviewItem?.title ?? "Featured image";
  const pendingAlt = pendingItem?.image?.alt ?? pendingItem?.title ?? "Next featured image";

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

  const renderDropcapTitle = useCallback((title: string) => {
    return title.split(/(\s+)/).map((part, partIndex) => {
      if (!part) return null;
      if (!part.trim()) {
        return (
          <span key={`space-${partIndex}`} className="whitespace-pre">
            {part}
          </span>
        );
      }

      const first = part.slice(0, 1);
      const rest = part.slice(1);

      return (
        <span key={`word-${partIndex}`} data-hero-word className="inline-block">
          <span data-hero-dropcap className="inline-block">
            {first}
          </span>
          {rest ? <span className="inline-block">{rest}</span> : null}
        </span>
      );
    });
  }, []);

  const renderIndexedTitle = useCallback(
    (title: string, index: number) => {
      const words = renderDropcapTitle(title);
      if (!showNumbers) return <span className="inline-block">{words}</span>;
      return (
        <>
          <span className="mr-2 inline-block tabular-nums opacity-70">{pad2(index + 1)}</span>
          <span className="inline-block">{words}</span>
        </>
      );
    },
    [renderDropcapTitle, showNumbers]
  );

  // ---------------------------------------
  // PAGE TRANSITION (non-hero)
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

      const activeHome = pathname === "/" ? getActiveHomeSection() : null;
      if (pathname === "/") saveActiveHomeSectionNow();
      else saveScrollForPath(pathname);

      let kind: PageTransitionKind = "simple";
      const isProjectRoute = safeHref.startsWith("/projects/");
      if (pathname === "/" && isProjectRoute && activeHome?.type === "hero-contents") {
        kind = "fadeHero";
      }

      await fadeOutPageRoot({ duration: 0.26 });

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

  // ---------------------------------------
  // RIGHT COLUMN ENTRANCE
  // ---------------------------------------
  useGSAP(
    () => {
      const left = leftRef.current;
      const right = rightRef.current;
      const nextLayer = nextLayerRef.current;

      if (!left || !right || !nextLayer) return;
      if (typeof window === "undefined") return;

      const prefersReduced =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      gsap.set(left, { autoAlpha: 1 });
      gsap.set(nextLayer, { autoAlpha: 0, clipPath: CLIP_HIDDEN_TOP });

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

  // ---------------------------------------
  // FOOTER + SCROLL HINT: ScrollTrigger on/off for this section
  // ---------------------------------------
  const footerAnimKey = useMemo(() => {
    const footerBodyLen = Array.isArray((props as any)?.footerBody) ? (props as any).footerBody.length : 0;
    const bottomLinksLen = Array.isArray((props as any)?.bottomLinks) ? (props as any).bottomLinks.length : 0;
    const c = String((props as any)?.copyrightText ?? "");
    return [
      "ld",
      loaderDone ? 1 : 0,
      "sh",
      showScrollHint ? 1 : 0,
      "sfd",
      showBottomDivider ? 1 : 0,
      "bl",
      bottomLayout,
      "sft",
      ((props as any)?.showFooterText ? 1 : 0),
      "fbl",
      footerBodyLen,
      "bll",
      bottomLinksLen,
      "ct",
      c.trim() ? 1 : 0,
    ].join("|");
  }, [bottomLayout, loaderDone, props, showBottomDivider, showScrollHint]);

  useGSAP(
    () => {
      if (typeof window === "undefined") return;

      const root = containerRef.current;
      if (!root) return;

      const footerEl = footerRef.current;
      const hintEl = scrollHintWrapRef.current;

      const targets = [footerEl, hintEl].filter(Boolean) as HTMLElement[];
      if (!targets.length) return;

      const prefersReduced =
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

      let raf = 0;
      let st: ScrollTrigger | null = null;
      let tl: gsap.core.Timeline | null = null;

      const getHsContainerAnimation = () => {
        const hs = ScrollTrigger.getById("hs-horizontal") as ScrollTrigger | null;
        return hs?.animation ?? null;
      };

      const getHsMode = () => {
        try {
          return (window as any).__hsMode as string | undefined;
        } catch {
          return undefined;
        }
      };

      const expectsHs = () => !!root.closest(".hs-rail");

      const kill = () => {
        try {
          st?.kill(true);
        } catch {
          // ignore
        }
        st = null;

        try {
          tl?.kill();
        } catch {
          // ignore
        }
        tl = null;

        gsap.set(targets, { clearProps: "willChange" });
      };

      const build = () => {
        kill();

        if (prefersReduced) {
          gsap.set(targets, { clearProps: "opacity,transform,visibility,willChange" });
          return;
        }

        // Out animation timeline: play to hide, reverse to show.
        gsap.set(targets, { autoAlpha: 1, y: 0, force3D: true, willChange: "transform,opacity" });

        tl = gsap.timeline({ paused: true, defaults: { overwrite: "auto" } });
        tl.to(targets, {
          autoAlpha: 0,
          y: 14,
          duration: 0.45,
          ease: "power2.out",
          stagger: 0.04,
          force3D: true,
          autoRound: false,
        });

        const containerAnimation = getHsContainerAnimation();
        const hsMode = getHsMode();
        const isHsVertical = hsMode === "vertical";
        const isInsideHs = expectsHs();

        // If we're inside HS rail but HS isn't ready (and we're not in vertical/mobile HS mode),
        // wait for hs-ready/hs-rebuilt to rebuild triggers.
        if (isInsideHs && !containerAnimation && !isHsVertical) return;

        const base: ScrollTrigger.Vars =
          containerAnimation && !isHsVertical
            ? {
              trigger: root,
              start: "left 20%",
              end: "right 80%",
              containerAnimation,
              invalidateOnRefresh: false,
            }
            : {
              trigger: root,
              start: "top 80%",
              end: "bottom 20%",
              invalidateOnRefresh: false,
            };

        st = ScrollTrigger.create({
          ...base,
          onEnter: () => tl?.reverse(),
          onEnterBack: () => tl?.reverse(),
          onLeave: () => tl?.play(),
          onLeaveBack: () => tl?.play(),
        });

        // Ensure correct initial state if the page loads mid-scroll.
        // Show when before/inside the trigger, hide only if we've passed the end.
        if (st) {
          st.refresh();
          if (st.progress >= 1) tl.progress(1);
          else tl.progress(0);
        }
      };

      const scheduleBuild = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(build);
      };

      scheduleBuild();

      window.addEventListener("hs-ready", scheduleBuild);
      window.addEventListener("hs-rebuilt", scheduleBuild);

      return () => {
        window.removeEventListener("hs-ready", scheduleBuild);
        window.removeEventListener("hs-rebuilt", scheduleBuild);
        if (raf) cancelAnimationFrame(raf);
        kill();
      };
    },
    { scope: containerRef, dependencies: [footerAnimKey] }
  );

  // ---------------------------------------
  // SCROLL HINT ARROW LOOP (existing)
  // ---------------------------------------
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
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    gsap.set(arrow, {
      x: 0,
      y: 0,
      svgOrigin: "27 6",
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

  // ---------------------------------------
  // LINKS RENDERERS
  // ---------------------------------------
  const renderLinksCustom = useCallback(() => {
    return (
      <>
        {keyed.map((it, index) => {
          const left = clampPct(it.x);
          const top = clampPct(it.y);
          const isActive = it._key === activeKey;
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
              <HeroUnderlineLink
                href={href}
                active={isActive}
                className={[
                  "py-1 px-2 text-lg md:text-xl font-serif font-normal tracking-tighter",
                  "transform-gpu origin-center transition-transform duration-300 ease-out",
                  !isActive && "hover:scale-[1.08]",
                  isActive ? "opacity-100" : "opacity-70 hover:opacity-100",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "true" : undefined}
                data-cursor="link"
                data-index={index}
                onClick={(e) => {
                  activateHeroLink(it._key, undefined, true);
                  handleTransitionClick(e, href, () => runIndexAction(index, it, "click"));
                }}
              >
                {renderIndexedTitle(it.title ?? "Untitled", index)}
              </HeroUnderlineLink>
            </div>
          );
        })}
      </>
    );
  }, [activeKey, activateHeroLink, handleActivate, handleTransitionClick, keyed, renderIndexedTitle, runIndexAction]);

  const renderLinksList = useCallback(() => {
    if (linksLayout === "center") {
      return (
        <div className="w-full h-full grid place-items-center pointer-events-auto">
          <div className="flex flex-col items-center text-center gap-1">
            {keyed.map((it, index) => {
              const isActive = it._key === activeKey;
              const href = it.slug ? `/projects/${it.slug}` : "#";

              return (
                <HeroUnderlineLink
                  key={it._key}
                  href={href}
                  active={isActive}
                  className={[
                    "text-lg md:text-xl font-serif font-normal tracking-tighter inline-block px-2 py-1",
                    isActive ? "opacity-100" : "opacity-70 hover:opacity-100",
                    !isActive && "hover:scale-[1.03]",
                    "transform-gpu origin-center transition-transform duration-300 ease-out",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => handleActivate(it, index, "hover")}
                  onFocus={() => handleActivate(it, index, "focus")}
                  onClick={(e) => {
                    activateHeroLink(it._key, undefined, true);
                    handleTransitionClick(e, href, () => runIndexAction(index, it, "click"));
                  }}
                  aria-current={isActive ? "true" : undefined}
                  data-cursor="link"
                  data-index={index}
                >
                  {renderIndexedTitle(it.title ?? "Untitled", index)}
                </HeroUnderlineLink>
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
              <HeroUnderlineLink
                key={it._key}
                href={href}
                active={isActive}
                className={[
                  "text-lg md:text-xl font-serif font-normal tracking-tighter inline-block px-2 py-1",
                  isActive ? "opacity-100" : "opacity-70 hover:opacity-100",
                  !isActive && "hover:scale-[1.03]",
                  "transform-gpu origin-center transition-transform duration-300 ease-out",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => handleActivate(it, index, "hover")}
                onFocus={() => handleActivate(it, index, "focus")}
                onClick={(e) => {
                  activateHeroLink(it._key, undefined, true);
                  handleTransitionClick(e, href, () => runIndexAction(index, it, "click"));
                }}
                aria-current={isActive ? "true" : undefined}
                data-cursor="link"
                data-index={index}
              >
                {renderIndexedTitle(it.title ?? "Untitled", index)}
              </HeroUnderlineLink>
            );
          })}
        </div>
      </div>
    );
  }, [
    activeKey,
    activateHeroLink,
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

  // ---- Bio ----
  const bio: BioSection = (props as any)?.bio ?? null;
  const bioBody = (bio as any)?.body ?? null;
  const bioDropCap = !!(bio as any)?.dropCap;
  const bioLinks: HeroLink[] = useMemo(() => {
    const raw = ((bio as any)?.links ?? []) as unknown[];
    return raw.filter((l): l is HeroLink => !!l && typeof l === "object");
  }, [bio]);

  // ---- Footer content ----
  const showFooterText: boolean = !!(props as any)?.showFooterText;
  const footerDropCap: boolean = !!(props as any)?.footerDropCap;
  const footerBody: any[] | null = ((props as any)?.footerBody as any[] | null) ?? null;

  const bottomLinks: HeroLink[] = useMemo(() => {
    const raw = (((props as any)?.bottomLinks ?? []) as unknown[]).filter(Boolean);
    return raw.filter((l): l is HeroLink => !!l && typeof l === "object");
  }, [props]);

  const bottomLinksRenderable: HeroLink[] = useMemo(() => {
    return bottomLinks.filter((l) => {
      const label = (l?.label ?? "").trim();
      const href = sanitizeHref(l?.href);
      return !!label && !!href;
    });
  }, [bottomLinks]);

  const copyrightTextRaw: string = (props as any)?.copyrightText ?? "";
  const copyrightText = useMemo(() => {
    const t = String(copyrightTextRaw ?? "").trim();
    return t || "";
  }, [copyrightTextRaw]);

  const footerTextNode = useMemo(() => {
    if (!showFooterText) return null;
    if (!footerBody?.length) return null;

    return (
      <HeroPortableText
        value={footerBody}
        dropCap={footerDropCap}
        variant="footer"
        className="tracking-tighter"
        maxWidthClassName="max-w-[33ch]"
      />
    );
  }, [footerBody, footerDropCap, showFooterText]);

  const renderBottomLinks = useCallback(() => {
    if (!bottomLinksRenderable.length) return null;

    return (
      <div className="flex gap-4 text-sm pointer-events-auto">
        {bottomLinksRenderable.map((l, idx) => {
          const label = (l?.label ?? "").trim();
          const href = sanitizeHref(l?.href);
          if (!label || !href) return null;

          const forceNewTab = !!l?.newTab;
          const external = isLikelyExternal(href);
          const target = forceNewTab || external ? "_blank" : undefined;
          const rel = target ? "noreferrer" : undefined;

          return (
            <UnderlineLink
              key={l?._key ?? `${label}-${idx}`}
              href={href}
              target={target}
              rel={rel}
              hoverUnderline
              data-cursor="link"
              className="opacity-90 hover:opacity-100"
            >
              {label}
            </UnderlineLink>
          );
        })}
      </div>
    );
  }, [bottomLinksRenderable]);

  const bottomLinksNode = useMemo(() => renderBottomLinks(), [renderBottomLinks]);

  const copyrightNode = useMemo(() => {
    if (!copyrightText) return null;
    return (
      <h2 className="text-xl md:text-base uppercase font-medium tracking-tighter opacity-50">
        {copyrightText}
      </h2>
    );
  }, [copyrightText]);

  const hasBottomRow = !!bottomLinksNode || !!copyrightNode;
  const shouldRenderFooter = !!footerTextNode || hasBottomRow;

  // ---- Arrow config ----
  const SHAFT_W = 20;
  const VIEW_W = 54;
  const SHAFT_Y = 5;
  const SHAFT_H = 1;
  const SHAFT_CY = SHAFT_Y + SHAFT_H / 2;

  const HEAD_SCALE = 2;
  const HEAD_CENTER_Y = 2.03;
  const HEAD_TIP_X = 4.97;
  const HEAD_W = HEAD_SCALE * HEAD_TIP_X;

  const HEAD_Y = SHAFT_CY - HEAD_CENTER_Y * HEAD_SCALE;
  const HEAD_X = SHAFT_W;

  const TOTAL_W = SHAFT_W + HEAD_W;
  const OFFSET_X = (VIEW_W - TOTAL_W) / 2;

  return (
    <section
      ref={containerRef}
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
            <BioBlock body={bioBody} dropCap={bioDropCap} links={bioLinks} />
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
        className="relative h-full px-6 pt-6 pb-5 overflow-hidden flex flex-col"
        style={{ contain: "layout paint" }}
      >
        {/* HEADER */}
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
        </div>

        {/* LINKS FIELD */}
        <div className="relative flex-1 pointer-events-none">
          <div className="relative w-full h-full">
            {linksLayout === "custom" ? renderLinksCustom() : renderLinksList()}
          </div>
        </div>

        {/* FOOTER (renders only if there’s something to show) */}
        {shouldRenderFooter ? (
          <div ref={footerRef} className="relative flex-none">
            {footerTextNode}

            {showBottomDivider && (footerTextNode || hasBottomRow) ? <BottomLine /> : null}

            {hasBottomRow ? (
              bottomLayout === "center" ? (
                <div className="mt-4 flex flex-col items-center text-center gap-3">
                  {bottomLinksNode}
                  {copyrightNode}
                </div>
              ) : (
                <div className="mt-2 flex items-end">
                  {bottomLinksNode ? <div className="flex-1">{bottomLinksNode}</div> : <div className="flex-1" />}
                  {copyrightNode}
                </div>
              )
            ) : null}
          </div>
        ) : null}

        {/* scroll hint (center vertically, right edge) */}
        {showScrollHint && loaderDone ? (
          <div
            ref={scrollHintWrapRef}
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
                  <rect
                    x={OFFSET_X}
                    y={SHAFT_Y}
                    width={SHAFT_W}
                    height={SHAFT_H}
                    rx="1"
                    fill="currentColor"
                  />

                  <g transform={`translate(${OFFSET_X + HEAD_X} ${HEAD_Y}) scale(${HEAD_SCALE})`}>
                    <polygon
                      points="4.97 2.03 0 4.06 1.18 2.03 0 0 4.97 2.03"
                      fill="currentColor"
                    />
                  </g>
                </g>
              </svg>

              <div className="text-[10px] uppercase tracking-tight opacity-25 font-serif">scroll</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="absolute right-6 top-6 z-30 hidden md:block">
        <span data-hero-main-title className="block">
          <BioBlock body={bioBody} dropCap={bioDropCap} links={bioLinks} />
        </span>
      </div>
    </section>
  );
}
