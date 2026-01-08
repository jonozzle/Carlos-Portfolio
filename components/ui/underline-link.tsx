// components/ui/underline-link.tsx
"use client";

import * as React from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

type Props = React.ComponentPropsWithoutRef<"a"> & {
  /**
   * Controlled “active” state (for nav / hero links).
   * When true: underline draws left -> right.
   * When false: underline retracts right -> left.
   */
  active?: boolean;

  /**
   * If true, underline also animates on hover/focus (useful for simple footer links).
   * Active still wins.
   */
  hoverUnderline?: boolean;

  underlineClassName?: string;

  /**
   * Customize underline draw timings/easing.
   */
  underlineInDuration?: number;
  underlineOutDuration?: number;
  underlineInEase?: string;
  underlineOutEase?: string;
};

const CLAMP = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const UnderlineLink = React.forwardRef<HTMLAnchorElement, Props>(function UnderlineLink(
  {
    active = false,
    hoverUnderline = false,
    className,
    underlineClassName,
    underlineInDuration = 0.38,
    underlineOutDuration = 0.32,
    underlineInEase = "power2.out",
    underlineOutEase = "power2.inOut",
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    children,
    ...rest
  },
  ref
) {
  const underlineRef = React.useRef<HTMLSpanElement | null>(null);
  const prefersNoMotionRef = React.useRef(false);

  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersNoMotionRef.current = mq.matches;

    const listener = (e: MediaQueryListEvent) => {
      prefersNoMotionRef.current = e.matches;
    };

    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const show = active || (hoverUnderline && hovered);
  const prevShowRef = React.useRef<boolean>(show);

  // Initial paint: set correct state with no tween.
  React.useLayoutEffect(() => {
    const el = underlineRef.current;
    if (!el || typeof window === "undefined") return;

    gsap.killTweensOf(el);
    gsap.set(el, {
      scaleX: show ? 1 : 0,
      transformOrigin: show ? "0% 50%" : "100% 50%",
    });

    prevShowRef.current = show;
  }, []); // mount only

  // Animate on state changes.
  React.useEffect(() => {
    const el = underlineRef.current;
    if (!el || typeof window === "undefined") return;

    const prev = prevShowRef.current;
    if (prev === show) return;

    gsap.killTweensOf(el);

    if (prefersNoMotionRef.current) {
      gsap.set(el, {
        scaleX: show ? 1 : 0,
        transformOrigin: show ? "0% 50%" : "100% 50%",
      });
      prevShowRef.current = show;
      return;
    }

    if (show) {
      // ON: left -> right
      gsap.set(el, { scaleX: 0, transformOrigin: "0% 50%" });
      gsap.to(el, {
        scaleX: 1,
        duration: underlineInDuration,
        ease: underlineInEase,
        overwrite: "auto",
      });
    } else {
      // OFF: right -> left
      gsap.set(el, { transformOrigin: "100% 50%" });
      gsap.to(el, {
        scaleX: 0,
        duration: underlineOutDuration,
        ease: underlineOutEase,
        overwrite: "auto",
      });
    }

    prevShowRef.current = show;
  }, [show, underlineInDuration, underlineInEase, underlineOutDuration, underlineOutEase]);

  return (
    <a
      {...rest}
      ref={ref}
      className={cn("inline-block", className)}
      onMouseEnter={(e) => {
        if (hoverUnderline) setHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (hoverUnderline) setHovered(false);
        onMouseLeave?.(e);
      }}
      onFocus={(e) => {
        if (hoverUnderline) setHovered(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        if (hoverUnderline) setHovered(false);
        onBlur?.(e);
      }}
    >
      <span className="relative inline-block">
        {children}
        <span
          ref={underlineRef}
          aria-hidden="true"
          className={cn(
            "absolute left-0 right-0 bottom-[0.2em] h-px bg-current will-change-transform transform-gpu",
            underlineClassName
          )}
          style={{ transform: "scaleX(0)", transformOrigin: "0% 50%" }}
        />
      </span>
    </a>
  );
});

UnderlineLink.displayName = "UnderlineLink";

export default UnderlineLink;
