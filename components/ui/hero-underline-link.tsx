// components/ui/hero-underline-link.tsx
"use client";

import * as React from "react";
import gsap from "gsap";
import UnderlineLink from "@/components/ui/underline-link";
import { cn } from "@/lib/utils";

export const HERO_LINK_FONT_DURATION = 1;
export const HERO_LINK_UNDERLINE_IN_DURATION = 0.5;
export const HERO_LINK_UNDERLINE_OUT_DURATION = 0.42;
export const HERO_LINK_WEIGHT_FADE_DURATION = 0.2;
const HERO_LINK_ACTIVE_FONT_SIZE_PX = 48;
const HERO_LINK_DROP_CAP_SCALE = 1.2;

type Props = React.ComponentPropsWithoutRef<typeof UnderlineLink> & {
  /**
   * Applied when `active` is true.
   * Defaults to a slightly heavier weight.
   */
  activeTextClassName?: string;

  /**
   * Applied when `active` is true.
   * Defaults match your request: underline thickness 2px.
   */
  activeUnderlineClassName?: string;

  /**
   * Target font size for the active state (in px).
   */
  activeFontSizePx?: number;

  /**
   * Active dropcap size multiplier relative to the active font size.
   */
  activeDropcapScale?: number;

  /**
   * Duration for font-size tweens (in seconds).
   */
  fontSizeDuration?: number;
};

export default function HeroUnderlineLink({
  active = false,
  className,
  underlineClassName = "bottom-[1em]",
  activeTextClassName = "font-semibold",
  activeUnderlineClassName = "h-[2px]",
  activeFontSizePx = HERO_LINK_ACTIVE_FONT_SIZE_PX,
  activeDropcapScale = HERO_LINK_DROP_CAP_SCALE,
  fontSizeDuration = HERO_LINK_FONT_DURATION,
  children,
  ...rest
}: Props) {
  const linkRef = React.useRef<HTMLAnchorElement | null>(null);
  const textRef = React.useRef<HTMLSpanElement | null>(null);
  const normalWeightRef = React.useRef<HTMLSpanElement | null>(null);
  const boldWeightRef = React.useRef<HTMLSpanElement | null>(null);
  const baseFontSizeRef = React.useRef<number | null>(null);
  const prefersReducedRef = React.useRef(false);
  const didMountRef = React.useRef(false);
  const sequenceRef = React.useRef<gsap.core.Tween | gsap.core.Timeline | null>(null);

  const [fontActive, setFontActive] = React.useState(active);
  const [underlineActive, setUnderlineActive] = React.useState(active);

  const setWeightOpacity = React.useCallback((toBold: boolean) => {
    const normal = normalWeightRef.current;
    const bold = boldWeightRef.current;
    if (!normal || !bold) return;

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

    if (!didMountRef.current) {
      didMountRef.current = true;
      setFontActive(active);
      setUnderlineActive(active);
      const normal = normalWeightRef.current;
      const bold = boldWeightRef.current;
      if (normal && bold) {
        gsap.set(normal, { opacity: active ? 0 : 1 });
        gsap.set(bold, { opacity: active ? 1 : 0 });
      }
      return;
    }

    sequenceRef.current?.kill();
    sequenceRef.current = null;

    if (prefersReducedRef.current) {
      setFontActive(active);
      setUnderlineActive(active);
      const normal = normalWeightRef.current;
      const bold = boldWeightRef.current;
      if (normal && bold) {
        gsap.set(normal, { opacity: active ? 0 : 1 });
        gsap.set(bold, { opacity: active ? 1 : 0 });
      }
      return;
    }

    if (active) {
      setUnderlineActive(false);
      setWeightOpacity(true);
      sequenceRef.current = gsap.timeline({ defaults: { overwrite: "auto" } });
      sequenceRef.current.to({}, { duration: HERO_LINK_WEIGHT_FADE_DURATION });
      sequenceRef.current.add(() => setFontActive(true));
      sequenceRef.current.to({}, { duration: fontSizeDuration });
      sequenceRef.current.add(() => setUnderlineActive(true));
      return;
    }

    setUnderlineActive(false);
    sequenceRef.current = gsap.timeline({ defaults: { overwrite: "auto" } });
    sequenceRef.current.to({}, { duration: HERO_LINK_UNDERLINE_OUT_DURATION });
    sequenceRef.current.add(() => setFontActive(false));
    sequenceRef.current.to({}, { duration: fontSizeDuration });
    sequenceRef.current.add(() => setWeightOpacity(false));
  }, [active, fontSizeDuration, setWeightOpacity]);

  React.useLayoutEffect(() => {
    const el = textRef.current ?? linkRef.current;
    if (!el || typeof window === "undefined") return;

    const baseSize = Number.parseFloat(window.getComputedStyle(el).fontSize);
    if (!Number.isNaN(baseSize)) baseFontSizeRef.current = baseSize;
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      if (active) return;
      const el = textRef.current ?? linkRef.current;
      if (!el) return;
      const baseSize = Number.parseFloat(window.getComputedStyle(el).fontSize);
      if (!Number.isNaN(baseSize)) baseFontSizeRef.current = baseSize;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [active]);

  React.useEffect(() => {
    const el = textRef.current ?? linkRef.current;
    if (!el || typeof window === "undefined") return;

    const baseSize =
      baseFontSizeRef.current ?? Number.parseFloat(window.getComputedStyle(el).fontSize);
    if (Number.isNaN(baseSize)) return;
    baseFontSizeRef.current = baseSize;

    const dropcaps = Array.from(el.querySelectorAll<HTMLElement>("[data-hero-dropcap]"));
    const targetFontSize = fontActive ? activeFontSizePx : baseSize;
    const targetDropcapSize = fontActive ? targetFontSize * activeDropcapScale : baseSize;

    gsap.killTweensOf([el, ...dropcaps]);

    if (prefersReducedRef.current) {
      if (fontActive) {
        gsap.set(el, { fontSize: targetFontSize, overwrite: "auto" });
        gsap.set(dropcaps, { fontSize: targetDropcapSize, overwrite: "auto" });
      } else {
        gsap.set(el, { clearProps: "fontSize" });
        gsap.set(dropcaps, { clearProps: "fontSize" });
      }
      return;
    }

    const tl = gsap.timeline({
      defaults: {
        duration: fontSizeDuration,
        ease: fontActive ? "expo.out" : "power3.inOut",
        overwrite: "auto",
      },
    });

    tl.to(el, { fontSize: targetFontSize }, 0);
    if (dropcaps.length) {
      tl.to(dropcaps, { fontSize: targetDropcapSize }, 0);
    }

    if (!fontActive) {
      tl.add(() => {
        gsap.set(el, { clearProps: "fontSize" });
        if (dropcaps.length) gsap.set(dropcaps, { clearProps: "fontSize" });
      });
    }

    return () => {
      tl.kill();
    };
  }, [fontActive, activeDropcapScale, activeFontSizePx, fontSizeDuration]);

  return (
    <UnderlineLink
      {...rest}
      ref={linkRef}
      active={underlineActive}
      className={className}
      underlineClassName={cn(underlineClassName, underlineActive && activeUnderlineClassName)}
      underlineInDuration={HERO_LINK_UNDERLINE_IN_DURATION}
      underlineOutDuration={HERO_LINK_UNDERLINE_OUT_DURATION}
      underlineInEase="expo.out"
      underlineOutEase="power3.inOut"
    >
      <span ref={textRef} data-hero-text className="relative inline-block whitespace-nowrap">
        <span ref={normalWeightRef} data-hero-weight="normal" className="relative inline-block">
          {children}
        </span>
        <span
          ref={boldWeightRef}
          data-hero-weight="bold"
          className={cn("absolute inset-0 inline-block", activeTextClassName)}
          aria-hidden="true"
        >
          {children}
        </span>
      </span>
    </UnderlineLink>
  );
}
