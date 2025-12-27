// components/blocks/page-link-section.tsx
"use client";

import React, {
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useState,
  CSSProperties,
} from "react";
import SmoothImage from "@/components/ui/smooth-image";
import { useTheme } from "@/components/theme-provider";
import PageTransitionButton from "@/components/page-transition-button";

const SCROLL_IDLE_DELAY = 500;

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

type ThemeContext = ReturnType<typeof useTheme>;

type TileProps = {
  item: PageLinkItem;
  index: number;
  isHalf: boolean;
  themeCtx: ThemeContext;
  activeIndex: number | null;
  setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>;
  isScrollingRef: React.MutableRefObject<boolean>;
};

/* -------------------------------------------------------
   Stylized label renderer (first letter large)
------------------------------------------------------- */
function StylizedLabel({ text }: { text: string }) {
  return (
    <span>
      {text.split(" ").map((word, i) => {
        if (!word.length) return null;

        return (
          <span key={i} className="mr-1 inline-block">
            <span className="text-[1.4em] leading-none inline-block">
              {word[0]}
            </span>
            <span>{word.slice(1)}</span>
          </span>
        );
      })}
    </span>
  );
}

/* -------------------------------------------------------
   Tile
------------------------------------------------------- */
const PageLinkTile = React.memo(function PageLinkTile({
  item,
  isHalf,
  index,
  themeCtx,
  activeIndex,
  setActiveIndex,
  isScrollingRef,
}: TileProps) {
  const imgTileRef = useRef<HTMLDivElement | null>(null);
  const { previewTheme, clearPreview, lockTheme } = themeCtx;

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

  const isActive = activeIndex === index && !isScrollingRef.current;
  const dimState: "active" | "inactive" = isActive ? "active" : "inactive";

  const clearHover = useCallback(() => {
    if (hasTheme) clearPreview();
    setActiveIndex((prev) => (prev === index ? null : prev));
  }, [hasTheme, clearPreview, setActiveIndex, index]);

  const handleEnter = useCallback(() => {
    if (isScrollingRef.current) return;
    if (hasTheme) previewTheme(theme);
    setActiveIndex(index);
  }, [hasTheme, previewTheme, theme, setActiveIndex, index, isScrollingRef]);

  const handleLeave = useCallback(() => {
    if (isScrollingRef.current) return;
    clearHover();
  }, [clearHover, isScrollingRef]);

  // Lock theme just before internal navigation kicks in.
  const handleInternalClickCapture = useCallback(() => {
    if (isInternal && hasTheme) lockTheme(theme);
  }, [isInternal, hasTheme, lockTheme, theme]);

  /* -------------------------------------------------------
     Shared text block
  ------------------------------------------------------- */
  const textBlock = (
    <div className="flex flex-col items-start text-left">
      <div className="text-xl md:text-4xl font-serif font-semibold leading-tight tracking-tighter">
        <StylizedLabel text={labelText} />
      </div>
      {item.subline ? (
        <div className="text-[11px] md:text-xs opacity-80 mt-1">
          {item.subline}
        </div>
      ) : null}
    </div>
  );

  // Props for hero-enabled internal nav
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
    // IMPORTANT: the direct parent of `fill` MUST be `relative` and have real size
    return (
      <div className="relative w-full h-full">
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
          <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
            No image
          </div>
        )}
      </div>
    );
  };

  /* -------------------------------------------------------
     Layout variants
  ------------------------------------------------------- */
  const renderContent = () => {
    // Non-clickable tile fallback
    if (!href) {
      return (
        <div className="flex flex-col h-full min-h-0 will-change-transform transform-gpu">
          <div className="relative w-full flex-1 min-h-0 overflow-hidden">
            {renderImage()}
          </div>
          <div className="mt-3 shrink-0">{textBlock}</div>
        </div>
      );
    }

    // Internal links → PageTransitionButton; external → <a>
    // IMPORTANT: wrapper must be `relative block w-full h-full` (no inset-0 unless absolute)
    const ImageWrapper: React.ComponentType<{ children: React.ReactNode }> =
      isInternal
        ? ({ children }) => (
          <PageTransitionButton
            {...(heroProps as any)}
            className="relative block w-full h-full overflow-hidden"
          >
            {children}
          </PageTransitionButton>
        )
        : ({ children }) => (
          <a
            href={href}
            className="relative block w-full h-full overflow-hidden"
          >
            {children}
          </a>
        );

    const TextWrapper: React.ComponentType<{ children: React.ReactNode }> =
      isInternal
        ? ({ children }) => (
          <PageTransitionButton
            {...(heroProps as any)}
            className="inline-flex flex-col text-left"
          >
            {children}
          </PageTransitionButton>
        )
        : ({ children }) => (
          <a href={href} className="inline-flex flex-col text-left">
            {children}
          </a>
        );

    switch (textPosition) {
      case "top-right":
        return (
          <div className="grid grid-cols-[3fr,2fr] gap-2 md:gap-3 h-full min-h-0 items-stretch">
            <div
              ref={imgTileRef}
              data-hero-slug={isInternal ? slug : undefined}
              className="relative w-full h-full min-h-0 overflow-hidden"
            >
              <ImageWrapper>{renderImage()}</ImageWrapper>
            </div>

            <div className="self-start">
              <TextWrapper>{textBlock}</TextWrapper>
            </div>
          </div>
        );

      case "center-over":
        return (
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
                  <span className="text-[11px] md:text-xs opacity-80 mt-1">
                    {item.subline}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );

      case "below-left":
      default:
        return (
          <div className="flex flex-col h-full min-h-0">
            <div
              ref={imgTileRef}
              data-hero-slug={isInternal ? slug : undefined}
              className="relative w-full flex-1 min-h-0 overflow-hidden"
            >
              <ImageWrapper>{renderImage()}</ImageWrapper>
            </div>

            <div className="mt-3 shrink-0">
              <TextWrapper>{textBlock}</TextWrapper>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      className="flex flex-col text-left cursor-pointer h-full min-h-0"
      data-dim-item={dimState}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      onClickCapture={handleInternalClickCapture}
    >
      {renderContent()}
    </div>
  );
});

/* -------------------------------------------------------
   Section wrapper
------------------------------------------------------- */
export default function PageLinkSection(props: Props) {
  const themeCtx = useTheme();
  const { clearPreview } = themeCtx;

  const items = useMemo(() => props.items ?? [], [props.items]);

  const isHalf = props.width === "half";
  const widthClass = isHalf ? "w-[50vw]" : "w-screen";
  const paddingMode = props.paddingMode ?? "default";

  const sectionRef = useRef<HTMLElement | null>(null);
  const isScrollingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  let paddingClass = "";
  const sectionStyle: CSSProperties = {
    containIntrinsicSize: "100vh 50vw",
  };

  if (paddingMode === "default") {
    paddingClass = "p-2 md:p-4";
  } else if (paddingMode === "none") {
    paddingClass = "p-0";
  } else if (paddingMode === "custom") {
    const v = typeof props.customPadding === "number" ? props.customPadding : 0;
    sectionStyle.padding = `${v}px`;
  }

  const tileColumns = isHalf
    ? "repeat(1, minmax(0, 1fr))"
    : "repeat(3, minmax(0, 1fr))";

  useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: number | null = null;

    const onScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;

        if (sectionRef.current) {
          sectionRef.current.style.pointerEvents = "none";
        }

        const root = document.documentElement;
        delete (root as any).dataset.dimItems;
      }

      if (timeoutId !== null) window.clearTimeout(timeoutId);

      timeoutId = window.setTimeout(() => {
        isScrollingRef.current = false;
        if (sectionRef.current) sectionRef.current.style.pointerEvents = "";

        setActiveIndex(null);
        clearPreview();
      }, SCROLL_IDLE_DELAY);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [clearPreview]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (activeIndex !== null && !isScrollingRef.current) {
      (root as any).dataset.dimItems = "true";
    } else {
      delete (root as any).dataset.dimItems;
    }
  }, [activeIndex]);

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
            const key =
              item._key || item.page?.slug || item.externalUrl || `pl-${index}`;

            return (
              <PageLinkTile
                key={key}
                item={item}
                index={index}
                isHalf={isHalf}
                themeCtx={themeCtx}
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                isScrollingRef={isScrollingRef}
              />
            );
          })
        ) : (
          <div className="col-span-1 grid place-items-center text-xs opacity-60">
            No links
          </div>
        )}
      </div>
    </section>
  );
}
