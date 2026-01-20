// PageLinkSection
// components/blocks/page-link-section.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import SmoothImage from "@/components/ui/smooth-image";
import { useThemeActions } from "@/components/theme-provider";
import PageTransitionButton from "@/components/page-transition-button";
import { completeHeroTransition } from "@/lib/hero-transition";
import { APP_EVENTS } from "@/lib/app-events";
import { getCurrentScrollY, setCurrentScrollY } from "@/lib/scroll-state";
import {
  HOVER_EVENTS,
  getLastMouse,
  installMouseTrackerOnce,
  isHoverLocked,
} from "@/lib/hover-lock";

type Theme = { bg?: string | null; text?: string | null } | null;

type ImageValue = {
  asset?: { url?: string | null } | null;
  alt?: string | null;
} | null;

type PageRef = {
  slug?: string | null;
  title?: string | null;
  theme?: Theme;
  featuredImage?: ImageValue;
} | null;

type TextPosition = "below-left" | "top-right" | "center-over";

type PageLinkItem = {
  _key: string;
  label?: string | null;
  subline?: string | null;
  externalUrl?: string | null;
  page?: PageRef;
  image?: ImageValue;
  textPosition?: TextPosition | null;
};

type Props = {
  _type: "page-link-section";
  _key: string;
  title?: string | null; // ignored
  items?: PageLinkItem[] | null;

  width?: "full" | "half" | null;
  paddingMode?: "none" | "default" | "custom" | null;
  customPadding?: number | null;
};

function isAppScrolling() {
  if (typeof window === "undefined") return false;
  return !!(window as any).__appScrolling;
}

function isMobileNow() {
  try {
    return window.matchMedia("(max-width: 767px)").matches;
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* -------------------------------------------------------
   Local stylized label (no ScrollTrigger here)
------------------------------------------------------- */
function StylizedLabel({ text }: { text: string }) {
  return (
    <span>
      {text.split(" ").map((word, i) => {
        if (!word.length) return null;
        return (
          <span key={i} className="mr-1 inline-block">
            <span className="text-[1.4em] leading-none inline-block">{word[0]}</span>
            <span>{word.slice(1)}</span>
          </span>
        );
      })}
    </span>
  );
}

type TileProps = {
  item: PageLinkItem;
  index: number;
  isHalf: boolean;
  activeIndex: number | null;
  setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>;
  isScrollingRef: React.MutableRefObject<boolean>;
  themeActions: ReturnType<typeof useThemeActions>;
};

const PageLinkTile = React.memo(function PageLinkTile({
  item,
  index,
  isHalf,
  activeIndex,
  setActiveIndex,
  isScrollingRef,
  themeActions,
}: TileProps) {
  const imgTileRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const imgScaleRef = useRef<HTMLDivElement | null>(null);
  const navLockedRef = useRef(false);
  const leaveRafRef = useRef<number | null>(null);

  const slug = item.page?.slug ?? "";
  const isExternal = !!item.externalUrl;
  const href = item.externalUrl || (slug ? `/${slug}` : "");
  const isInternal = !!slug && !isExternal;

  const theme = item.page?.theme ?? null;
  const hasTheme = !!(theme?.bg || theme?.text);
  const { previewTheme, clearPreview, lockTheme } = themeActions;

  const imgUrl = item.image?.asset?.url ?? "";
  const alt = item.image?.alt ?? item.label ?? item.page?.title ?? "Page";

  const textPosition: TextPosition =
    (item.textPosition as TextPosition | undefined) ?? "below-left";

  const labelText = item.label ?? item.page?.title ?? "Untitled";
  const sizes = isHalf ? "50vw" : "33vw";
  const isActive = activeIndex === index;
  const dimState: "active" | "inactive" = isActive ? "active" : "inactive";

  const [heroState, setHeroState] = useState<"idle" | "transitioning" | "shown">(() => {
    if (typeof window === "undefined" || !slug) return "idle";
    const pending = (window as any).__heroPending as { slug?: string } | undefined;
    return pending?.slug === slug ? "transitioning" : "idle";
  });
  const [isHeroMatch, setIsHeroMatch] = useState(false);

  const animateScale = useCallback((to: number) => {
    const el = imgScaleRef.current;
    if (!el) return;

    gsap.killTweensOf(el);
    gsap.to(el, {
      scale: to,
      duration: 0.55,
      ease: "power3.out",
      overwrite: true,
    });
  }, []);

  const hardResetScale = useCallback(() => {
    const el = imgScaleRef.current;
    if (!el) return;
    gsap.killTweensOf(el);
    gsap.set(el, { scale: 1 });
  }, []);

  useLayoutEffect(() => {
    const el = imgScaleRef.current;
    if (!el) return;
    gsap.set(el, { scale: 1, transformOrigin: "50% 50%" });
    return () => {
      gsap.killTweensOf(el);
    };
  }, []);

  const cancelPendingLeave = useCallback(() => {
    if (leaveRafRef.current !== null) {
      cancelAnimationFrame(leaveRafRef.current);
      leaveRafRef.current = null;
    }
  }, []);

  const isPointerInside = useCallback(() => {
    const el = imgTileRef.current;
    if (!el) return false;

    const pos = getLastMouse();
    if (pos) {
      const under = document.elementFromPoint(pos.x, pos.y);
      return !!(under && el.contains(under));
    }

    return el.matches(":hover");
  }, []);

  const isPointerOverAnyCell = useCallback(() => {
    if (typeof document === "undefined") return false;
    const pos = getLastMouse();
    if (pos) {
      const hit = document.elementFromPoint(pos.x, pos.y) as HTMLElement | null;
      return !!(hit && hit.closest("[data-page-link-cell]"));
    }
    return !!document.querySelector("[data-page-link-cell]:hover");
  }, []);

  const clearHover = useCallback(
    (forceAnim?: boolean) => {
      if (navLockedRef.current) return;
      if (hasTheme) {
        const opts = forceAnim ? { animate: true, force: true } : undefined;
        clearPreview(opts);
      }
      setActiveIndex((prev) => (prev === index ? null : prev));
      animateScale(1);
    },
    [animateScale, clearPreview, hasTheme, index, setActiveIndex]
  );

  const applyHover = useCallback(
    (allowIdle?: boolean, skipScale?: boolean) => {
      if (navLockedRef.current) return;
      if (isScrollingRef.current) return;
      if (isHoverLocked()) return;

      const forceAnim = isAppScrolling();
      const opts = allowIdle || forceAnim ? { allowIdle: !!allowIdle, force: forceAnim } : undefined;

      if (hasTheme) previewTheme(theme, opts);
      setActiveIndex(index);
      if (!skipScale) animateScale(1.1);
    },
    [animateScale, hasTheme, index, isScrollingRef, previewTheme, setActiveIndex, theme]
  );

  const applyHoverUnderPointer = useCallback(
    (allowIdle?: boolean) => {
      const el = imgTileRef.current;
      if (!el) return;
      if (!isPointerInside()) return;

      const scaleEl = imgScaleRef.current;
      const scaleNow = scaleEl ? gsap.getProperty(scaleEl, "scale") : 1;
      const scaleNum =
        typeof scaleNow === "number" ? scaleNow : Number.parseFloat(String(scaleNow));
      const isScaled = Number.isFinite(scaleNum) ? scaleNum > 1.02 : false;

      if (!isScaled) hardResetScale();
      requestAnimationFrame(() => applyHover(allowIdle, isScaled));
    },
    [applyHover, hardResetScale, isPointerInside]
  );

  const handleEnter = useCallback(() => {
    cancelPendingLeave();
    applyHover();
  }, [cancelPendingLeave, applyHover]);

  const handleLeave = useCallback(() => {
    if (navLockedRef.current) return;
    if (isHoverLocked()) return;

    const appScrolling = isAppScrolling();
    if ((appScrolling || isScrollingRef.current) && isPointerInside()) return;

    cancelPendingLeave();
    leaveRafRef.current = requestAnimationFrame(() => {
      leaveRafRef.current = null;
      if (navLockedRef.current) return;
      if (isHoverLocked()) return;
      if (isPointerOverAnyCell()) return;
      clearHover(isAppScrolling());
    });
  }, [
    cancelPendingLeave,
    clearHover,
    isPointerInside,
    isPointerOverAnyCell,
    isScrollingRef,
  ]);

  const handleNavLockCapture = useCallback(() => {
    if (!slug) return;
    navLockedRef.current = true;

    if (hasTheme) {
      lockTheme(theme, { animate: false, force: true, durationMs: 0 });
    }

    const el = imgScaleRef.current;
    if (el) gsap.killTweensOf(el);
  }, [hasTheme, lockTheme, slug, theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onUnlocked = () => {
      if (isAppScrolling()) return;
      applyHoverUnderPointer(true);
    };

    window.addEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked);
    return () => window.removeEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked as any);
  }, [applyHoverUnderPointer]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScrollEnd = () => {
      applyHoverUnderPointer(true);
    };

    window.addEventListener(APP_EVENTS.SCROLL_END, onScrollEnd);
    return () => window.removeEventListener(APP_EVENTS.SCROLL_END, onScrollEnd as any);
  }, [applyHoverUnderPointer]);

  useEffect(() => {
    return () => {
      cancelPendingLeave();
    };
  }, [cancelPendingLeave]);

  // Hero overlay -> this tile (page -> home case)
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!slug) return;
    if (!imgTileRef.current) return;

    const pending = (window as any).__heroPending as { slug?: string } | undefined;
    const match = !!pending && pending.slug === slug;
    setIsHeroMatch(match);

    if (match) {
      setHeroState("transitioning");

      const scaleEl = imgScaleRef.current;
      if (scaleEl) {
        gsap.killTweensOf(scaleEl);
        gsap.set(scaleEl, { scale: 1 });
      }

      let raf = 0;
      let frames = 0;
      let ran = false;

      let lastRect: { left: number; top: number; width: number; height: number } | null = null;
      let stableCount = 0;

      const EPS = 0.75;
      const STABLE_FRAMES = 4;
      const MAX_FRAMES = 360;

      let nudged = false;

      const rectDelta = (
        a: { left: number; top: number; width: number; height: number },
        b: { left: number; top: number; width: number; height: number }
      ) =>
        Math.abs(a.left - b.left) +
        Math.abs(a.top - b.top) +
        Math.abs(a.width - b.width) +
        Math.abs(a.height - b.height);

      const rectOk = (r: DOMRect) =>
        Number.isFinite(r.left) &&
        Number.isFinite(r.top) &&
        Number.isFinite(r.width) &&
        Number.isFinite(r.height) &&
        r.width > 2 &&
        r.height > 2;

      const isTargetInViewport = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        if (!rectOk(r)) return false;

        const vw = window.innerWidth || 1;
        const vh = window.innerHeight || 1;

        const slackX = vw * 0.25;
        const slackY = vh * 0.25;

        return r.right > -slackX && r.left < vw + slackX && r.bottom > -slackY && r.top < vh + slackY;
      };

      const nudgeIntoView = (el: HTMLElement) => {
        if (nudged) return;
        nudged = true;

        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;

        const targetY = getCurrentScrollY() + r.top - (vh / 2 - r.height / 2);
        setCurrentScrollY(targetY);

        lastRect = null;
        stableCount = 0;
      };

      const run = () => {
        if (ran) return;
        ran = true;

        const el = imgTileRef.current;
        if (!el) return;

        completeHeroTransition({
          slug,
          targetEl: el,
          mode: "parkThenPage",
        });
      };

      const tick = () => {
        frames += 1;

        try {
          ScrollTrigger.update();
        } catch {
          // ignore
        }

        const el = imgTileRef.current;
        if (!el) return;

        const r = el.getBoundingClientRect();
        if (!rectOk(r)) {
          if (frames < MAX_FRAMES) raf = requestAnimationFrame(tick);
          else raf = requestAnimationFrame(() => requestAnimationFrame(run));
          return;
        }

        const now = { left: r.left, top: r.top, width: r.width, height: r.height };

        if (lastRect) {
          const d = rectDelta(now, lastRect);
          if (d < EPS) stableCount += 1;
          else stableCount = 0;
        }
        lastRect = now;

        const inView = isTargetInViewport(el);

        if (isMobileNow() && !inView && frames === 12) {
          nudgeIntoView(el);
          raf = requestAnimationFrame(tick);
          return;
        }

        if (inView && stableCount >= STABLE_FRAMES) {
          raf = requestAnimationFrame(() => requestAnimationFrame(run));
          return;
        }

        if (frames < MAX_FRAMES) {
          raf = requestAnimationFrame(tick);
          return;
        }

        raf = requestAnimationFrame(() => requestAnimationFrame(run));
      };

      const start = () => {
        raf = requestAnimationFrame(tick);
      };

      if ((window as any).__homeHsRestored) {
        start();
      } else {
        const onHomeRestored = () => start();
        window.addEventListener(APP_EVENTS.HOME_HS_RESTORED, onHomeRestored, { once: true });
        return () => {
          window.removeEventListener(APP_EVENTS.HOME_HS_RESTORED, onHomeRestored as any);
          if (raf) cancelAnimationFrame(raf);
        };
      }

      return () => {
        if (raf) cancelAnimationFrame(raf);
      };
    }

  }, [slug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!slug) return;

    const onHeroShow = (event: Event) => {
      const detail = (event as CustomEvent).detail as { slug?: string } | undefined;
      if (detail?.slug === slug) setHeroState("shown");
    };

    window.addEventListener("hero-page-hero-show", onHeroShow);
    return () => {
      window.removeEventListener("hero-page-hero-show", onHeroShow as any);
    };
  }, [slug]);

  const heroProps = isInternal
    ? {
      href,
      direction: "up" as const,
      heroSlug: slug,
      heroSourceRef: imgTileRef as React.RefObject<HTMLDivElement | null>,
      heroImgUrl: imgUrl,
    }
    : null;

  const isHeroImageHidden = isHeroMatch && heroState !== "shown";

  const renderImage = () => {
    return (
      <div className="relative w-full h-full overflow-hidden" style={{ opacity: isHeroImageHidden ? 0 : 1 }}>
        <div
          ref={imgScaleRef}
          data-hero-img-scale
          className="relative w-full h-full will-change-transform transform-gpu"
        >
          {imgUrl ? (
            <SmoothImage
              src={imgUrl}
              alt={alt}
              fill
              sizes={sizes}
              lqipWidth={0}
              objectFit="cover"
              loading="eager"
              fetchPriority="high"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs opacity-60">No image</div>
          )}
        </div>
      </div>
    );
  };

  const textBlock = (
    <div className="flex flex-col items-start text-left">
      <div className="text-2xl md:text-4xl font-serif font-semibold leading-tight tracking-tighter">
        <StylizedLabel text={labelText} />
      </div>
      {item.subline ? (
        <div className="text-[11px] md:text-xs opacity-80 mt-1">{item.subline}</div>
      ) : null}
    </div>
  );

  const imageContent = renderImage();
  const imageWrapped = !href ? (
    imageContent
  ) : isInternal ? (
    <PageTransitionButton
      {...(heroProps as any)}
      className="relative block w-full h-full overflow-hidden"
    >
      {imageContent}
    </PageTransitionButton>
  ) : (
    <a href={href} className="relative block w-full h-full overflow-hidden">
      {imageContent}
    </a>
  );

  const textWrapped = !href ? (
    textBlock
  ) : isInternal ? (
    <PageTransitionButton {...(heroProps as any)} className="inline-flex flex-col text-left">
      {textBlock}
    </PageTransitionButton>
  ) : (
    <a href={href} className="inline-flex flex-col text-left">
      {textBlock}
    </a>
  );

  const content =
    textPosition === "top-right" ? (
      <div className="grid grid-cols-[3fr,2fr] gap-2 md:gap-3 h-full min-h-0 items-stretch">
        <div
          ref={imgTileRef}
          data-hero-slug={isInternal ? slug : undefined}
          data-hero-target={isInternal ? "home" : undefined}
          className="relative w-full h-full min-h-0 overflow-hidden"
          data-dim-item={dimState}
        >
          {imageWrapped}
        </div>

        <div ref={textRef} className="self-start" data-dim-item={dimState}>
          {textWrapped}
        </div>
      </div>
    ) : textPosition === "center-over" ? (
      <div
        ref={imgTileRef}
        data-hero-slug={isInternal ? slug : undefined}
        data-hero-target={isInternal ? "home" : undefined}
        className="relative w-full h-full min-h-0 overflow-hidden"
        data-dim-item={dimState}
      >
        {imageWrapped}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <div className="inline-flex flex-col items-center text-center">
            <span className="text-6xl md:text-8xl font-serif font-semibold tracking-tighter">
              <StylizedLabel text={labelText} />
            </span>
            {item.subline ? (
              <span className="text-[11px] md:text-xs opacity-80 mt-1">{item.subline}</span>
            ) : null}
          </div>
        </div>
      </div>
    ) : (
      <div className="flex flex-col h-full min-h-0">
        <div
          ref={imgTileRef}
          data-hero-slug={isInternal ? slug : undefined}
          data-hero-target={isInternal ? "home" : undefined}
          className="relative w-full flex-1 min-h-0 overflow-hidden"
          data-dim-item={dimState}
        >
          {imageWrapped}
        </div>

        <div ref={textRef} className="mt-3 shrink-0" data-dim-item={dimState}>
          {textWrapped}
        </div>
      </div>
    );

  return (
    <div
      className="flex flex-col text-left cursor-pointer h-full min-h-0"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocusCapture={handleEnter}
      onBlurCapture={handleLeave}
      onPointerDownCapture={handleNavLockCapture}
      onClickCapture={handleNavLockCapture}
      data-page-link-cell
    >
      {content}
    </div>
  );
});

export default function PageLinkSection(props: Props) {
  const theme = useThemeActions();
  const items = useMemo(() => props.items ?? [], [props.items]);
  const sectionRef = useRef<HTMLElement | null>(null);

  const isHalf = props.width === "half";

  // Mobile (<md): always full width.
  // md+: keep existing behavior (half => 50vw, full => screen).
  const widthClass = isHalf ? "w-screen md:w-[50vw]" : "w-screen";

  const paddingMode = props.paddingMode ?? "default";

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dimParticipationRef = useRef(false);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    installMouseTrackerOnce();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: number | null = null;

    const onScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
      }

      if (timeoutId !== null) window.clearTimeout(timeoutId);

      timeoutId = window.setTimeout(() => {
        isScrollingRef.current = false;
      }, 0);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const root = document.documentElement as HTMLElement & { dataset: DOMStringMap };
    const w = window as any;
    if (w.__dimItemsCount == null) w.__dimItemsCount = 0;

    const currentlyActive = activeIndex !== null;

    if (currentlyActive && !dimParticipationRef.current) {
      w.__dimItemsCount += 1;
      dimParticipationRef.current = true;
      root.dataset.dimItems = "true";
    } else if (!currentlyActive && dimParticipationRef.current) {
      w.__dimItemsCount = Math.max(0, (w.__dimItemsCount || 1) - 1);
      dimParticipationRef.current = false;
      if (w.__dimItemsCount === 0) {
        delete root.dataset.dimItems;
      }
    }

    return () => {
      if (dimParticipationRef.current) {
        w.__dimItemsCount = Math.max(0, (w.__dimItemsCount || 1) - 1);
        dimParticipationRef.current = false;
        if (w.__dimItemsCount === 0) {
          delete root.dataset.dimItems;
        }
      }
    };
  }, [activeIndex]);

  const clearAll = useCallback(
    (opts?: { force?: boolean }) => {
      setActiveIndex(null);

      const forceAnim = typeof opts?.force === "boolean" ? opts.force : isAppScrolling();
      const themeOpts = forceAnim ? { animate: true, force: true } : undefined;
      theme.clearPreview(themeOpts);
    },
    [theme]
  );

  const isPointerOverCell = useCallback(() => {
    if (typeof document === "undefined") return false;

    const pos = getLastMouse();
    if (pos) {
      const hit = document.elementFromPoint(pos.x, pos.y) as HTMLElement | null;
      if (hit && hit.closest("[data-page-link-cell]")) return true;
    }

    return !!document.querySelector("[data-page-link-cell]:hover");
  }, []);

  // On scroll end, re-sync hover/theme with the element under the pointer.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScrollEnd = () => {
      if (isPointerOverCell()) return;
      clearAll({ force: isAppScrolling() });
    };
    window.addEventListener(APP_EVENTS.SCROLL_END, onScrollEnd);

    return () => window.removeEventListener(APP_EVENTS.SCROLL_END, onScrollEnd as any);
  }, [clearAll, isPointerOverCell]);

  let paddingClass = "";
  const sectionStyle: CSSProperties = { containIntrinsicSize: "100vh 50vw" };

  if (paddingMode === "default") paddingClass = "p-10 md:p-6";
  else if (paddingMode === "none") paddingClass = "p-0";
  else if (paddingMode === "custom") {
    const v = typeof props.customPadding === "number" ? props.customPadding : 0;
    sectionStyle.padding = `${v}px`;
  }

  const tileColumns = isHalf ? "repeat(1, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))";

  return (
    <section
      ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
      className={`${widthClass} h-screen ${paddingClass} gap-2 md:gap-3 grid grid-cols-12 grid-rows-12 relative overflow-hidden will-change-transform`}
      style={sectionStyle}
    >
      <div
        className="col-span-12 row-span-12 grid h-full min-h-0 items-stretch"
        style={{
          gridColumn: "1 / span 12",
          gridRow: "1 / span 12",
          gridTemplateColumns: tileColumns,
          gridAutoRows: "1fr",
        }}
      >
        {items.length ? (
          items.map((item, index) => {
            const key = item._key || item.page?.slug || item.externalUrl || `pl-${index}`;
            return (
              <PageLinkTile
                key={key}
                item={item}
                index={index}
                isHalf={isHalf}
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                isScrollingRef={isScrollingRef}
                themeActions={theme}
              />
            );
          })
        ) : (
          <div className="col-span-1 grid place-items-center text-xs opacity-60">No links</div>
        )}
      </div>
    </section>
  );
}
