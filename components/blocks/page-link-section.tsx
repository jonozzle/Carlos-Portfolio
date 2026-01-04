// PageLinkSection
// components/blocks/page-link-section.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { gsap } from "gsap";
import SmoothImage from "@/components/ui/smooth-image";
import { useThemeActions } from "@/components/theme-provider";
import PageTransitionButton from "@/components/page-transition-button";
import { APP_EVENTS } from "@/lib/app-events";
import {
  HOVER_EVENTS,
  getLastMouse,
  hasRecentPointerMove,
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

type TileHandle = {
  dimEls: Array<HTMLElement | null>;
  hitEl: HTMLElement | null;
  setHover: (on: boolean, immediate?: boolean) => void;
};

type TileProps = {
  item: PageLinkItem;
  index: number;
  isHalf: boolean;
  register: (index: number, handle: TileHandle) => void;
  unregister: (index: number) => void;
  activate: (index: number, theme: Theme) => void;
  activateFromUnlock: (index: number, theme: Theme) => void;
  deactivate: (index: number) => void;
};

const PageLinkTile = React.memo(function PageLinkTile({
  item,
  index,
  isHalf,
  register,
  unregister,
  activate,
  activateFromUnlock,
  deactivate,
}: TileProps) {
  const hitRef = useRef<HTMLDivElement | null>(null);
  const imgTileRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const imgScaleRef = useRef<HTMLDivElement | null>(null);

  const slug = item.page?.slug ?? "";
  const isExternal = !!item.externalUrl;
  const href = item.externalUrl || (slug ? `/${slug}` : "");
  const isInternal = !!slug && !isExternal;

  const theme = item.page?.theme ?? null;
  const hasTheme = !!(theme?.bg || theme?.text);

  const imgUrl = item.image?.asset?.url ?? "";
  const alt = item.image?.alt ?? item.label ?? item.page?.title ?? "Page";

  const textPosition: TextPosition =
    (item.textPosition as TextPosition | undefined) ?? "below-left";

  const labelText = item.label ?? item.page?.title ?? "Untitled";
  const sizes = isHalf ? "50vw" : "33vw";

  const setHover = useCallback((on: boolean, immediate?: boolean) => {
    const el = imgScaleRef.current;
    if (!el) return;

    gsap.killTweensOf(el);

    if (immediate) {
      gsap.set(el, { scale: 1 });
      return;
    }

    gsap.to(el, {
      scale: on ? 1.1 : 1,
      duration: 0.55,
      ease: "power3.out",
      overwrite: true,
    });
  }, []);

  useEffect(() => {
    register(index, {
      dimEls: [imgTileRef.current, textRef.current],
      hitEl: hitRef.current,
      setHover,
    });

    return () => unregister(index);
  }, [index, register, unregister, setHover]);

  // When hover unlocks after transition, if mouse is currently over this tile, apply hover smoothly.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onUnlocked = () => {
      const hit = hitRef.current;
      if (!hit) return;

      const pos = getLastMouse();
      if (!pos) return;

      const under = document.elementFromPoint(pos.x, pos.y);
      if (under && hit.contains(under)) {
        // baseline first, then activate (bypass idle gating)
        setHover(false, true);
        requestAnimationFrame(() => activateFromUnlock(index, theme));
      }
    };

    window.addEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked);
    return () => window.removeEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked as any);
  }, [activateFromUnlock, index, theme, setHover]);

  const onMouseEnter = useCallback(() => {
    if (isAppScrolling()) return;
    if (isHoverLocked()) return;
    if (!hasRecentPointerMove(180)) return;

    activate(index, hasTheme ? theme : null);
  }, [activate, index, hasTheme, theme]);

  const onMouseLeave = useCallback(() => {
    if (isAppScrolling()) return;
    if (isHoverLocked()) return;
    deactivate(index);
  }, [deactivate, index]);

  const onFocus = useCallback(() => {
    if (isAppScrolling()) return;
    if (isHoverLocked()) return;
    activate(index, hasTheme ? theme : null);
  }, [activate, index, hasTheme, theme]);

  const onBlur = useCallback(() => {
    if (isAppScrolling()) return;
    if (isHoverLocked()) return;
    deactivate(index);
  }, [deactivate, index]);

  const heroProps = isInternal
    ? {
      href,
      direction: "up" as const,
      heroSlug: slug,
      heroSourceRef: imgTileRef as React.RefObject<HTMLDivElement | null>,
      heroImgUrl: imgUrl,
    }
    : null;

  const renderImage = () => {
    return (
      <div className="relative w-full h-full overflow-hidden">
        <div ref={imgScaleRef} className="relative w-full h-full will-change-transform transform-gpu">
          {imgUrl ? (
            <SmoothImage
              src={imgUrl}
              alt={alt}
              fill
              sizes={sizes}
              lqipWidth={16}
              objectFit="cover"
              loading="lazy"
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
      <div className="text-xl md:text-4xl font-serif font-semibold leading-tight tracking-tighter">
        <StylizedLabel text={labelText} />
      </div>
      {item.subline ? (
        <div className="text-[11px] md:text-xs opacity-80 mt-1">{item.subline}</div>
      ) : null}
    </div>
  );

  const ImageWrapper: React.ComponentType<{ children: React.ReactNode }> = !href
    ? ({ children }) => <>{children}</>
    : isInternal
      ? ({ children }) => (
        <PageTransitionButton
          {...(heroProps as any)}
          className="relative block w-full h-full overflow-hidden"
        >
          {children}
        </PageTransitionButton>
      )
      : ({ children }) => (
        <a href={href} className="relative block w-full h-full overflow-hidden">
          {children}
        </a>
      );

  const TextWrapper: React.ComponentType<{ children: React.ReactNode }> = !href
    ? ({ children }) => <>{children}</>
    : isInternal
      ? ({ children }) => (
        <PageTransitionButton {...(heroProps as any)} className="inline-flex flex-col text-left">
          {children}
        </PageTransitionButton>
      )
      : ({ children }) => (
        <a href={href} className="inline-flex flex-col text-left">
          {children}
        </a>
      );

  const content =
    textPosition === "top-right" ? (
      <div className="grid grid-cols-[3fr,2fr] gap-2 md:gap-3 h-full min-h-0 items-stretch">
        <div
          ref={imgTileRef}
          data-hero-slug={isInternal ? slug : undefined}
          className="relative w-full h-full min-h-0 overflow-hidden"
        >
          <ImageWrapper>{renderImage()}</ImageWrapper>
        </div>

        <div ref={textRef} className="self-start">
          <TextWrapper>{textBlock}</TextWrapper>
        </div>
      </div>
    ) : textPosition === "center-over" ? (
      <div
        ref={imgTileRef}
        data-hero-slug={isInternal ? slug : undefined}
        className="relative w-full h-full min-h-0 overflow-hidden"
      >
        <ImageWrapper>{renderImage()}</ImageWrapper>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <div className="inline-flex flex-col items-center text-center">
            <span className="text-lg md:text-8xl font-serif font-semibold tracking-tighter">
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
          className="relative w-full flex-1 min-h-0 overflow-hidden"
        >
          <ImageWrapper>{renderImage()}</ImageWrapper>
        </div>

        <div ref={textRef} className="mt-3 shrink-0">
          <TextWrapper>{textBlock}</TextWrapper>
        </div>
      </div>
    );

  return (
    <div
      ref={hitRef}
      className="flex flex-col text-left cursor-pointer h-full min-h-0"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {content}
    </div>
  );
});

export default function PageLinkSection(props: Props) {
  const theme = useThemeActions();
  const items = useMemo(() => props.items ?? [], [props.items]);

  const isHalf = props.width === "half";
  const widthClass = isHalf ? "w-[50vw]" : "w-screen";
  const paddingMode = props.paddingMode ?? "default";

  const activeRef = useRef<number | null>(null);
  const handlesRef = useRef(new Map<number, TileHandle>());

  const register = useCallback((index: number, handle: TileHandle) => {
    handlesRef.current.set(index, handle);
  }, []);

  const unregister = useCallback((index: number) => {
    handlesRef.current.delete(index);
  }, []);

  const setDim = useCallback((activeIndex: number | null) => {
    activeRef.current = activeIndex;

    for (const [i, h] of handlesRef.current.entries()) {
      for (const el of h.dimEls) {
        if (!el) continue;
        if (activeIndex == null) {
          el.removeAttribute("data-dim-item");
        } else {
          el.setAttribute("data-dim-item", i === activeIndex ? "active" : "inactive");
        }
      }
    }

    try {
      const root = document.documentElement as any;
      if (activeIndex == null) delete root.dataset.dimItems;
      else root.dataset.dimItems = "true";
    } catch {
      // ignore
    }
  }, []);

  const clearAll = useCallback(
    (immediateScale = false) => {
      const curr = activeRef.current;
      setDim(null);
      theme.clearPreview({ animate: true });

      if (curr != null) {
        const h = handlesRef.current.get(curr);
        h?.setHover(false, immediateScale);
      } else {
        // ensure no tile is stuck scaled
        for (const h of handlesRef.current.values()) h.setHover(false, immediateScale);
      }
    },
    [setDim, theme]
  );

  const activate = useCallback(
    (index: number, t: Theme) => {
      const prev = activeRef.current;

      if (prev != null && prev !== index) {
        handlesRef.current.get(prev)?.setHover(false);
      }

      setDim(index);

      if (t?.bg || t?.text) theme.previewTheme(t, { animate: true });
      else theme.clearPreview({ animate: true });

      handlesRef.current.get(index)?.setHover(true);
    },
    [setDim, theme]
  );

  const activateFromUnlock = useCallback(
    (index: number, t: Theme) => {
      // baseline first (avoids “jump” when the home becomes visible under the pointer)
      handlesRef.current.get(index)?.setHover(false, true);

      // bypass idle gating (this is explicitly after unlock)
      const prev = activeRef.current;
      if (prev != null && prev !== index) handlesRef.current.get(prev)?.setHover(false);

      setDim(index);

      if (t?.bg || t?.text) theme.previewTheme(t, { animate: true });
      else theme.clearPreview({ animate: true });

      handlesRef.current.get(index)?.setHover(true);
    },
    [setDim, theme]
  );

  const deactivate = useCallback(
    (index: number) => {
      if (activeRef.current !== index) return;
      clearAll(false);
    },
    [clearAll]
  );

  // Clear on scroll start (prevents hover/theme churn while scrolling)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScrollStart = () => clearAll(true);
    window.addEventListener(APP_EVENTS.SCROLL_START, onScrollStart);

    return () => window.removeEventListener(APP_EVENTS.SCROLL_START, onScrollStart as any);
  }, [clearAll]);

  let paddingClass = "";
  const sectionStyle: CSSProperties = { containIntrinsicSize: "100vh 50vw" };

  if (paddingMode === "default") paddingClass = "p-2 md:p-4";
  else if (paddingMode === "none") paddingClass = "p-0";
  else if (paddingMode === "custom") {
    const v = typeof props.customPadding === "number" ? props.customPadding : 0;
    sectionStyle.padding = `${v}px`;
  }

  const tileColumns = isHalf
    ? "repeat(1, minmax(0, 1fr))"
    : "repeat(3, minmax(0, 1fr))";

  return (
    <section
      className={`${widthClass} h-screen ${paddingClass} gap-2 md:gap-3 grid grid-cols-12 grid-rows-12 relative overflow-hidden will-change-transform`}
      style={sectionStyle}
      onMouseLeave={() => {
        if (isAppScrolling()) return;
        if (isHoverLocked()) return;
        clearAll(false);
      }}
      onBlurCapture={() => {
        if (isAppScrolling()) return;
        if (isHoverLocked()) return;
        clearAll(false);
      }}
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
                register={register}
                unregister={unregister}
                activate={activate}
                activateFromUnlock={activateFromUnlock}
                deactivate={deactivate}
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
