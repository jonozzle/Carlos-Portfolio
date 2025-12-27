// components/blocks/half-width-single-project.tsx
"use client";

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import SmoothImage from "@/components/ui/smooth-image";
import { useTheme } from "@/components/theme-provider";
import { startHeroTransition } from "@/lib/hero-transition";
import { predecodeNextImages } from "@/lib/predecode";

const SCROLL_IDLE_DELAY = 500;

type Theme = {
  bg?: any;
  text?: any;
} | null;

type SingleGalleryItem = {
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
  _type: "half-width-single-project";
  _key: string;
  title?: string | null;
  project?: SingleGalleryItem | null;
};

type Slot = {
  img: { col: string; row: string };
  info: { col: string; row: string; align?: "left" | "right" };
};

const SLOT: Slot = {
  img: { col: "2 / span 10", row: "3 / span 6" },
  info: { col: "2 / span 10", row: "9 / span 3", align: "left" },
};

type ThemeContext = ReturnType<typeof useTheme>;
type RouterType = ReturnType<typeof useRouter>;

type CellProps = {
  item: SingleGalleryItem;
  slot: Slot;
  themeCtx: ThemeContext;
  router: RouterType;
  index: number;
  activeIndex: number | null;
  setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>;
  isScrollingRef: React.MutableRefObject<boolean>;
};

const HalfWidthSingleProjectCell = React.memo(function HalfWidthSingleProjectCell({
  item,
  slot,
  themeCtx,
  router,
  index,
  activeIndex,
  setActiveIndex,
  isScrollingRef,
}: CellProps) {
  const tileRef = useRef<HTMLDivElement | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const slug = item?.slug ?? "";
  const href = slug ? `/projects/${slug}` : "#";
  const imgUrl = item?.image?.asset?.url || "";
  const alt = item?.image?.alt ?? item?.title ?? "Project image";
  const theme = item?.theme ?? null;
  const hasTheme = !!(theme?.bg || theme?.text);

  const { previewTheme, clearPreview, lockTheme } = themeCtx;

  const isActive = activeIndex === index && !isScrollingRef.current;
  const dimState = isActive ? "active" : "inactive";

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const commitHover = useCallback(() => {
    if (isScrollingRef.current) return;
    if (hasTheme) previewTheme(theme);
    setActiveIndex(index);
  }, [hasTheme, previewTheme, theme, index, setActiveIndex, isScrollingRef]);

  const handleEnter = useCallback(() => {
    if (isScrollingRef.current) return;
    clearHoverTimeout();
    hoverTimeoutRef.current = window.setTimeout(commitHover, 80);
  }, [commitHover, isScrollingRef]);

  const handleLeave = useCallback(() => {
    clearHoverTimeout();
    if (isScrollingRef.current) return;
    if (hasTheme) clearPreview();
    setActiveIndex((prev) => (prev === index ? null : prev));
  }, [hasTheme, clearPreview, setActiveIndex, index, isScrollingRef]);

  const doNavigate = useCallback(() => {
    if (!slug) return;

    if (typeof document !== "undefined") {
      const pageRoot = document.querySelector<HTMLElement>("#page-root");
      if (pageRoot) pageRoot.classList.add("fade-out");
    }

    if (hasTheme) lockTheme(theme);
    router.push(href);
  }, [slug, hasTheme, lockTheme, theme, router, href]);

  const handleClick = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      if (e) e.preventDefault();

      if (!slug || !imgUrl || !tileRef.current) {
        doNavigate();
        return;
      }

      if (hasTheme) lockTheme(theme);

      startHeroTransition({
        slug,
        sourceEl: tileRef.current,
        imgUrl,
        onNavigate: () => {
          router.push(href);
        },
      });
    },
    [slug, imgUrl, doNavigate, hasTheme, lockTheme, theme, router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick(e);
      }
    },
    [handleClick]
  );

  useEffect(
    () => () => {
      clearHoverTimeout();
    },
    []
  );

  return (
    <div
      className="contents"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocusCapture={handleEnter}
      onBlurCapture={handleLeave}
    >
      {/* Image tile */}
      <div
        ref={tileRef}
        className="relative block cursor-pointer z-10"
        style={{ gridColumn: slot.img.col, gridRow: slot.img.row }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        data-dim-item={dimState}
      >
        <div className="relative w-full h-full overflow-hidden">
          {imgUrl ? (
            <SmoothImage
              src={imgUrl}
              alt={alt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              lqipWidth={24}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs opacity-60">
              No image
            </div>
          )}
        </div>
      </div>

      {/* Info block */}
      <button
        type="button"
        className="relative z-10 flex flex-col justify-start text-left"
        style={{
          gridColumn: slot.info.col,
          gridRow: slot.info.row,
          alignItems:
            slot.info.align === "right" ? "flex-end" : "flex-start",
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-dim-item={dimState}
      >
        <h3 className="text-lg md:text-4xl font-serif font-bold leading-tight tracking-tighter">
          {item?.title ?? "Untitled"}
        </h3>
        <div className="-mt-1 flex w-full font-serif text-sm md:text-base tracking-tighter">
          <span>{item?.year ? String(item.year) : "\u00A0"}</span>
          <span className="mr-1">,</span>
          <span className="italic">{item?.client ?? "\u00A0"}</span>
        </div>
      </button>
    </div>
  );
});

export default function HalfWidthSingleProject(props: Props) {
  const item = useMemo(() => props.project ?? null, [props.project]);
  const themeCtx = useTheme();
  const { clearPreview } = themeCtx;
  const router = useRouter();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const isScrollingRef = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  // Scroll listener: no React state updates per scroll frame
  useEffect(() => {
    if (typeof window === "undefined") return;

    let timeoutId: number | null = null;

    const onScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;

        if (sectionRef.current) {
          sectionRef.current.style.pointerEvents = "none";
        }

        // Clear active hover / theme immediately when scrolling begins
        setActiveIndex(null);
        clearPreview();

        const root = document.documentElement;
        delete root.dataset.dimItems;
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

  // Toggle global dim flag based on active state (no scroll-driven renders)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (activeIndex !== null && !isScrollingRef.current) {
      root.dataset.dimItems = "true";
    } else {
      delete root.dataset.dimItems;
    }
  }, [activeIndex]);

  // Pre-decode images when this section is approaching the viewport
  useEffect(() => {
    if (typeof window === "undefined" || !sectionRef.current) return;

    const sectionEl = sectionRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          predecodeNextImages(sectionEl, 4);
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
      className="w-[50vw] h-screen p-2 gap-2 grid grid-cols-12 grid-rows-12 relative overflow-hidden will-change-transform"
      style={{
        contentVisibility: "auto",
        contain: "layout paint style",
        containIntrinsicSize: "100vh 50vw",
      }}
    >
      {props.title ? (
        <div
          className="pointer-events-none px-4 md:px-6"
          style={{
            gridColumn: "1 / span 8",
            gridRow: "1 / span 1",
            alignSelf: "center",
          }}
        >
          <h2 className="text-base md:text-xl italic tracking-tight">
            {props.title}
          </h2>
        </div>
      ) : null}

      {item ? (
        <HalfWidthSingleProjectCell
          item={item}
          slot={SLOT}
          themeCtx={themeCtx}
          router={router}
          index={0}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          isScrollingRef={isScrollingRef}
        />
      ) : (
        <div
          className="col-span-12 row-span-12 grid place-items-center text-xs opacity-60"
          style={{ gridColumn: "1 / span 12", gridRow: "1 / span 12" }}
        >
          No project
        </div>
      )}
    </section>
  );
}
