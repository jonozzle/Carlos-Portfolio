// components/ui/hero-underline-link.tsx
"use client";

import * as React from "react";
import gsap from "gsap";
import UnderlineLink from "@/components/ui/underline-link";
import { cn } from "@/lib/utils";

// Kept exports so existing imports don’t break.
export const HERO_LINK_FONT_DURATION = 0.22; // now used for scale tween duration
export const HERO_LINK_UNDERLINE_IN_DURATION = 0.22;
export const HERO_LINK_UNDERLINE_OUT_DURATION = 0.22;
export const HERO_LINK_WEIGHT_FADE_DURATION = 0.12;

const HERO_LINK_ACTIVE_SCALE = 1.15;

type Props = React.ComponentPropsWithoutRef<typeof UnderlineLink> & {
  /**
   * Applied when `active` is true (and also used as the "bold" layer class).
   */
  activeTextClassName?: string;

  /**
   * Applied when `active` is true.
   */
  activeUnderlineClassName?: string;

  /**
   * Duration for the active scale tween (in seconds).
   * (Name kept for backwards compatibility.)
   */
  fontSizeDuration?: number;

  /**
   * Active scale factor (transform). Keep small to avoid overlap.
   */
  activeScale?: number;

  /**
   * Where to place the underline relative to the TITLE line.
   * (This no longer tracks the full anchor height, so details can sit below.)
   */
  underlineClassName?: string;

  /**
   * Force the title to render bold at all times (no weight swap),
   * while still allowing scale/underline to respond to active/hover/focus.
   */
  alwaysBold?: boolean;
};

type ColumnWrapperProps = {
  className?: string;
  children?: React.ReactNode;
};

function isColumnWrapper(el: React.ReactElement<ColumnWrapperProps>) {
  const cls = el.props.className;
  return typeof cls === "string" && cls.includes("flex-col");
}

type SplitTitleResult = {
  wrapper: React.ReactElement<ColumnWrapperProps> | null;
  title: React.ReactNode;
  details: React.ReactNode[] | null;
};

function splitTitleAndDetails(children: React.ReactNode): SplitTitleResult {
  // Default: everything is "title"
  const fallback = {
    wrapper: null,
    title: children,
    details: null as React.ReactNode[] | null,
  };

  // Only split when the top-level child is a single wrapper element that stacks children vertically.
  if (!React.isValidElement(children)) return fallback;

  const wrapper = children as React.ReactElement<ColumnWrapperProps>;
  if (!isColumnWrapper(wrapper)) return fallback;

  const parts = React.Children.toArray(wrapper.props?.children).filter(
    (n) => n !== null && n !== undefined
  );

  if (parts.length < 2) return fallback;

  return {
    wrapper,
    title: parts[0] ?? null,
    details: parts.slice(1),
  };
}

export default function HeroUnderlineLink({
  active = false,
  className,

  // Underline should sit under the title line (not under any details below).
  underlineClassName = "bottom-[6px]",

  activeTextClassName = "font-semibold",
  activeUnderlineClassName = "h-[1px]",

  fontSizeDuration = HERO_LINK_FONT_DURATION,
  activeScale = HERO_LINK_ACTIVE_SCALE,

  alwaysBold = false,

  children,
  ...rest
}: Props) {
  const linkRef = React.useRef<HTMLAnchorElement | null>(null);

  const titleScaleRef = React.useRef<HTMLSpanElement | null>(null);

  const normalWeightRef = React.useRef<HTMLSpanElement | null>(null);
  const boldWeightRef = React.useRef<HTMLSpanElement | null>(null);
  const underlineRef = React.useRef<HTMLSpanElement | null>(null);

  const prefersReducedRef = React.useRef(false);
  const didMountRef = React.useRef(false);

  const hoverRef = React.useRef(false);
  const focusRef = React.useRef(false);

  const [isBelowDesktop, setIsBelowDesktop] = React.useState(false);

  const setWeightOpacity = React.useCallback((toBold: boolean, immediate = false) => {
    const normal = normalWeightRef.current;
    const bold = boldWeightRef.current;
    if (!normal || !bold) return;

    if (immediate) {
      gsap.set(normal, { opacity: toBold ? 0 : 1 });
      gsap.set(bold, { opacity: toBold ? 1 : 0 });
      return;
    }

    gsap.to(normal, {
      opacity: toBold ? 0 : 1,
      duration: HERO_LINK_WEIGHT_FADE_DURATION,
      ease: "power2.out",
      overwrite: "auto",
    });
    gsap.to(bold, {
      opacity: toBold ? 1 : 0,
      duration: HERO_LINK_WEIGHT_FADE_DURATION,
      ease: "power2.out",
      overwrite: "auto",
    });
  }, []);

  const syncUnderline = React.useCallback(
    (immediate = false) => {
      const u = underlineRef.current;
      if (!u) return;

      const on = !!active || hoverRef.current || focusRef.current;

      gsap.killTweensOf(u);
      gsap.set(u, { transformOrigin: "0% 50%" });

      if (immediate || prefersReducedRef.current) {
        gsap.set(u, { scaleX: on ? 1 : 0 });
        return;
      }

      gsap.to(u, {
        scaleX: on ? 1 : 0,
        duration: on ? HERO_LINK_UNDERLINE_IN_DURATION : HERO_LINK_UNDERLINE_OUT_DURATION,
        ease: on ? "power3.out" : "power2.out",
        overwrite: "auto",
      });
    },
    [active]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      prefersReducedRef.current = mq.matches;
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsBelowDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Scale + weight swap
  React.useEffect(() => {
    const titleEl = titleScaleRef.current;
    if (!titleEl || typeof window === "undefined") return;

    gsap.killTweensOf(titleEl);

    // scale the TITLE only (not the whole link wrapper)
    const targetScale = active ? activeScale : 1;
    const transformOrigin = isBelowDesktop ? "50% 50%" : "0% 100%";

    const boldOn = alwaysBold || active;

    if (!didMountRef.current) {
      didMountRef.current = true;
      gsap.set(titleEl, { scale: targetScale, transformOrigin });
      setWeightOpacity(boldOn, true);
      syncUnderline(true);
      return;
    }

    if (prefersReducedRef.current) {
      gsap.set(titleEl, { scale: targetScale, transformOrigin });
      setWeightOpacity(boldOn, true);
      syncUnderline(true);
      return;
    }

    gsap.to(titleEl, {
      scale: targetScale,
      duration: fontSizeDuration,
      ease: active ? "power3.out" : "power2.out",
      overwrite: "auto",
      transformOrigin,
    });

    // If alwaysBold is on, this keeps it bold regardless of active state.
    setWeightOpacity(boldOn, false);

    // underline follows active/hover/focus
    syncUnderline(false);
  }, [
    active,
    activeScale,
    fontSizeDuration,
    setWeightOpacity,
    syncUnderline,
    alwaysBold,
    isBelowDesktop,
  ]);

  // If active changes while hovered/focused, keep underline correct.
  React.useEffect(() => {
    syncUnderline(prefersReducedRef.current);
  }, [active, syncUnderline]);

  const { wrapper, title, details } = React.useMemo(() => splitTitleAndDetails(children), [children]);

  const titleNode = title ?? children;

  const titleWithUnderline = (
    <span ref={titleScaleRef} className="relative inline-block whitespace-nowrap">
      {/* Reserve the *max* width (bold) so underline reaches the end consistently. */}
      <span className={cn("invisible inline-block", activeTextClassName)} aria-hidden="true">
        {titleNode}
      </span>

      <span
        ref={normalWeightRef}
        data-hero-weight="normal"
        className="absolute left-0 top-0 inline-block"
      >
        {titleNode}
      </span>

      <span
        ref={boldWeightRef}
        data-hero-weight="bold"
        className={cn("absolute left-0 top-0 inline-block", activeTextClassName)}
        aria-hidden="true"
      >
        {titleNode}
      </span>

      {/* Custom underline that is anchored to the TITLE line only */}
      <span
        ref={underlineRef}
        aria-hidden="true"
        className={cn(
          "absolute left-0 right-0 bg-current",
          "scale-x-0",
          underlineClassName,
          activeUnderlineClassName
        )}
        style={{ height: 1 }}
      />
    </span>
  );

  const content = React.useMemo(() => {
    if (!wrapper) return titleWithUnderline;

    // Rebuild the original wrapper (keeps layout classes like inline-flex flex-col items-start)
    // but replace its first child (title) with our title+underline, and append the details under it.
    return React.cloneElement(wrapper, wrapper.props, [titleWithUnderline, ...(details ?? [])]);
  }, [details, titleWithUnderline, wrapper]);

  const { onMouseEnter, onMouseLeave, onFocus, onBlur, ...linkProps } = rest as any;

  return (
    <UnderlineLink
      {...linkProps}
      ref={linkRef}
      active={active}
      className={cn("inline-block transform-gpu", className)}
      // disable UnderlineLink’s own underline; we render a title-only underline ourselves
      underlineClassName="hidden"
      underlineInDuration={HERO_LINK_UNDERLINE_IN_DURATION}
      underlineOutDuration={HERO_LINK_UNDERLINE_OUT_DURATION}
      underlineInEase="power3.out"
      underlineOutEase="power2.out"
      onMouseEnter={(e: any) => {
        onMouseEnter?.(e);
        hoverRef.current = true;
        syncUnderline(false);
      }}
      onMouseLeave={(e: any) => {
        onMouseLeave?.(e);
        hoverRef.current = false;
        syncUnderline(false);
      }}
      onFocus={(e: any) => {
        onFocus?.(e);
        focusRef.current = true;
        syncUnderline(false);
      }}
      onBlur={(e: any) => {
        onBlur?.(e);
        focusRef.current = false;
        syncUnderline(false);
      }}
    >
      {content}
    </UnderlineLink>
  );
}
