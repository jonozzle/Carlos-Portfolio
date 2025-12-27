"use client";

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  useEffect,
} from "react";
import SmoothImage from "@/components/ui/smooth-image";
import { useTheme } from "@/components/theme-provider";
import { predecodeNextImages } from "@/lib/predecode";
import PageTransitionButton from "@/components/page-transition-button";
import { completeHeroTransition } from "@/lib/hero-transition";

const SCROLL_IDLE_DELAY = 500;

type Theme = {
  bg?: any;
  text?: any;
} | null;

type ThreeGalleryItem = {
  slug?: string | null;
  title?: string | null;
  client?: string | null;
  year?: number | null;
  theme?: Theme;
  image?: {
    asset?: { url?: string | null } | null;
    alt?: string | null;
  } | null;
};

type Props = {
  _type: "three-gallery";
  _key: string;
  title?: string | null;
  layout?: "A" | "B" | null;
  items?: ThreeGalleryItem[] | null;
};

type Slot = {
  img: { col: string; row: string };
  info: { col: string; row: string; align?: "left" | "right" };
};

const LAYOUTS: Record<"A" | "B", Slot[]> = {
  A: [
    {
      img: { col: "1 / span 6", row: "1 / span 6" },
      info: { col: "7 / span 3", row: "1 / span 2", align: "left" },
    },
    {
      img: { col: "7 / span 3", row: "7 / span 6" },
      info: { col: "10 / span 2", row: "7 / span 2", align: "left" },
    },
    {
      img: { col: "6 / span 7", row: "9 / span 4" },
      info: { col: "1 / span 4", row: "5 / span 3", align: "left" },
    },
  ],
  B: [
    {
      img: { col: "1 / span 6", row: "3 / span 6" },
      info: { col: "1 / span 4", row: "1 / span 2", align: "left" },
    },
    {
      img: { col: "7 / span 6", row: "1 / span 9" },
      info: { col: "7 / span 5", row: "10 / span 3", align: "right" },
    },
    {
      img: { col: "3 / span 4", row: "9 / span 4" },
      info: { col: "1 / span 2", row: "9 / span 3", align: "left" },
    },
  ],
};

type ThemeContext = ReturnType<typeof useTheme>;

type GalleryCellProps = {
  item: ThreeGalleryItem;
  slot: Slot;
  index: number;
  themeCtx: ThemeContext;
  activeIndex: number | null;
  setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>;
  isScrollingRef: React.MutableRefObject<boolean>;
};

const ThreeGalleryCell = React.memo(function ThreeGalleryCell({
  item,
  slot,
  index,
  themeCtx,
  activeIndex,
  setActiveIndex,
  isScrollingRef,
}: GalleryCellProps) {
  const tileRef = useRef<HTMLDivElement | null>(null);

  const slug = item?.slug ?? "";
  const href = slug ? `/projects/${slug}` : "#";
  const imgUrl = item?.image?.asset?.url || "";
  const alt = item?.image?.alt ?? item?.title ?? "Project image";
  const theme = item?.theme ?? null;
  const hasTheme = !!(theme?.bg || theme?.text);

  const { previewTheme, clearPreview } = themeCtx;
  const isActive = activeIndex === index && !isScrollingRef.current;
  const dimState: "active" | "inactive" = isActive ? "active" : "inactive";

  const [heroState, setHeroState] = useState<"idle" | "transitioning" | "shown">(
    () => {
      if (typeof window === "undefined" || !slug) return "idle";
      const pending = (window as any).__heroPending as
        | { slug?: string }
        | undefined;
      return pending?.slug === slug ? "transitioning" : "idle";
    }
  );

  const [isHeroMatch, setIsHeroMatch] = useState(false);

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

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!slug) return;
    if (!tileRef.current) return;

    const pending = (window as any).__heroPending as
      | { slug?: string }
      | undefined;

    const match = !!pending && pending.slug === slug;
    setIsHeroMatch(match);

    // Debug
    // eslint-disable-next-line no-console
    console.log("[ThreeGalleryCell hero]", {
      tileSlug: slug,
      pendingSlug: pending?.slug,
      hasPending: !!pending,
    });

    if (match) {
      setHeroState("transitioning");

      completeHeroTransition({
        slug,
        targetEl: tileRef.current,
        mode: "parkThenPage",
      });
    }

    const onHeroShow = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { slug?: string }
        | undefined;
      if (detail?.slug === slug) {
        setHeroState("shown");
      }
    };

    window.addEventListener("hero-page-hero-show", onHeroShow);
    return () => {
      window.removeEventListener("hero-page-hero-show", onHeroShow);
    };
  }, [slug]);

  const buttonCommonProps = slug
    ? {
      href,
      direction: "up" as const,
      heroSlug: slug,
      heroSourceRef: tileRef as React.RefObject<HTMLDivElement | null>,
      heroImgUrl: imgUrl,
    }
    : {
      href,
      direction: "up" as const,
    };

  // CRUCIAL: if this tile is the hero match, keep its image hidden until
  // we get hero-page-hero-show (heroState === "shown").
  const isHeroImageHidden = isHeroMatch && heroState !== "shown";

  return (
    <div
      className="contents"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocusCapture={handleEnter}
      onBlurCapture={handleLeave}
    >
      {/* IMAGE TILE – hero source/target */}
      <div
        ref={tileRef}
        style={{ gridColumn: slot.img.col, gridRow: slot.img.row }}
        data-hero-slug={slug || undefined}
        data-dim-item={dimState}
      >
        <PageTransitionButton
          {...buttonCommonProps}
          className="block w-full h-full cursor-pointer"
        >
          <div
            className="relative w-full h-full overflow-hidden"
            style={{ opacity: isHeroImageHidden ? 0 : 1 }}
          >
            {imgUrl ? (
              <SmoothImage
                src={imgUrl}
                alt={alt}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                lqipWidth={24}
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
                No image
              </div>
            )}
          </div>
        </PageTransitionButton>
      </div>

      {/* INFO BLOCK */}
      <div
        style={{
          gridColumn: slot.info.col,
          gridRow: slot.info.row,
          alignItems: slot.info.align === "right" ? "flex-end" : "flex-start",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
        }}
        data-dim-item={dimState}
      >
        <PageTransitionButton
          {...buttonCommonProps}
          className="flex flex-col justify-start text-left"
        >
          <div className="flex flex-col items-start">
            <h3 className="text-lg md:text-4xl font-serif font-bold leading-tight tracking-tighter">
              {item?.title ?? "Untitled"}
            </h3>
            <div className="-mt-1 flex w-full font-serif text-sm md:text-base tracking-tighter">
              <span>{item?.year ? String(item.year) : "\u00A0"}</span>
              <span className="mr-1">,</span>
              <span className="italic">{item?.client ?? "\u00A0"}</span>
            </div>
          </div>
        </PageTransitionButton>
      </div>
    </div>
  );
});

export default function ThreeGallery(props: Props) {
  const items = useMemo(() => (props.items ?? []).slice(0, 3), [props.items]);
  const layoutKey: "A" | "B" = props.layout ?? "A";
  const slots = LAYOUTS[layoutKey];

  const themeCtx = useTheme();
  const { clearPreview } = themeCtx;

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const isScrollingRef = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  const dimParticipationRef = useRef(false);

  // Dim other items when one is active
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined")
      return;

    const root = document.documentElement as HTMLElement & {
      dataset: DOMStringMap;
    };
    const w = window as any;
    if (w.__dimItemsCount == null) w.__dimItemsCount = 0;

    const currentlyActive = activeIndex !== null && !isScrollingRef.current;

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

  // Scroll listener: avoid hover / theme updates while scrolling
  useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: number | null = null;

    const onScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;

        if (sectionRef.current) {
          sectionRef.current.style.pointerEvents = "none";
        }

        setActiveIndex(null);
        clearPreview();
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        isScrollingRef.current = false;
        if (sectionRef.current) {
          sectionRef.current.style.pointerEvents = "";
        }
      }, SCROLL_IDLE_DELAY);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [clearPreview]);

  // Pre-decode images when this section is approaching the viewport
  useEffect(() => {
    if (typeof window === "undefined" || !sectionRef.current) return;

    const sectionEl = sectionRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          predecodeNextImages(sectionEl, 8);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: "50% 0px",
        threshold: 0,
      }
    );

    observer.observe(sectionEl);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef as React.MutableRefObject<HTMLElement | null>}
      className="w-screen h-screen p-4 gap-2 grid grid-cols-12 grid-rows-12 relative overflow-hidden will-change-transform"
      style={{
        contentVisibility: "auto",
        contain: "layout paint style",
        containIntrinsicSize: "100vh 100vw",
      }}
    >
      {props.title ? (
        <div
          className="pointer-events-none px-4 md:px-6"
          style={{
            gridColumn: "1 / span 6",
            gridRow: "1 / span 1",
            alignSelf: "center",
          }}
        >
          <h2 className="text-base md:text-xl italic tracking-tight">
            {props.title}
          </h2>
        </div>
      ) : null}

      {items.map((it, i) => {
        const slot = slots[i];
        if (!slot) return null;

        const key = it.slug ?? `cell-${i}`;

        return (
          <ThreeGalleryCell
            key={key}
            item={it}
            slot={slot}
            index={i}
            themeCtx={themeCtx}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
            isScrollingRef={isScrollingRef}
          />
        );
      })}
    </section>
  );
}
