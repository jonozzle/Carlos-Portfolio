// components/cursor.tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { APP_EVENTS } from "@/lib/app-events";

const ROOT_SELECTOR = ".has-custom-cursor";
const ACTIVE_CLASS = "custom-cursor-active";
const INTERACTIVE_SELECTOR =
  "[data-cursor-scale],[data-cursor],a,button,[role='button'],input,textarea,select,label,summary,.cursor-pointer";

function isFinePointer() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    window.matchMedia("(pointer: fine)").matches &&
    window.matchMedia("(hover: hover)").matches
  );
}

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const vendor = navigator.vendor || "";
  return /Safari/i.test(ua) && /Apple/i.test(vendor) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
}

function getCursorRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(ROOT_SELECTOR);
}

function setRootActive(active: boolean) {
  const root = getCursorRoot();
  if (!root) return;
  root.classList.toggle(ACTIVE_CLASS, active);
}

function resolveInteractive(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  if (el.closest("[data-cursor-ui], #transition-layer")) return null;
  return el.closest<HTMLElement>(INTERACTIVE_SELECTOR);
}

export default function Cursor({
  size = 12,
}: {
  size?: number;
  growScale?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);

  const shownRef = useRef(false);
  const hasMovedRef = useRef(false);
  const hoveredRef = useRef(false);
  const safariRef = useRef(false);
  const moveRafRef = useRef<number | null>(null);
  const hasPendingMoveRef = useRef(false);
  const pendingPosRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });

  const lastPos = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });

  const reset = useCallback((moveOffscreen: boolean) => {
    const wrap = wrapRef.current;
    const dot = dotRef.current;
    if (!wrap) return;

    shownRef.current = false;
    hoveredRef.current = false;
    hasPendingMoveRef.current = false;
    setRootActive(false);

    gsap.killTweensOf(wrap);
    if (dot) {
      gsap.killTweensOf(dot);
      gsap.set(dot, { scale: 1, force3D: true });
    }

    wrap.dataset.hovered = "false";

    gsap.set(wrap, {
      autoAlpha: 0,
      scale: 0.001,
      x: moveOffscreen ? -9999 : lastPos.current.x,
      y: moveOffscreen ? -9999 : lastPos.current.y,
      force3D: true,
    });
  }, []);

  const show = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (shownRef.current) return;

    shownRef.current = true;
    setRootActive(true);

    gsap.killTweensOf(wrap);
    if (safariRef.current) {
      gsap.set(wrap, { autoAlpha: 1, scale: 1, force3D: true });
      return;
    }

    gsap.to(wrap, {
      autoAlpha: 1,
      scale: 1,
      duration: 0.14,
      ease: "power3.out",
      overwrite: "auto",
      force3D: true,
    });
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const dot = dotRef.current;
    if (!wrap) return;
    if (!dot) return;
    if (typeof window === "undefined") return;

    if (!isFinePointer()) {
      gsap.set(wrap, { display: "none" });
      setRootActive(false);
      return;
    }
    safariRef.current = isSafariBrowser();
    if (safariRef.current) wrap.dataset.safari = "true";
    else delete wrap.dataset.safari;

    gsap.set(wrap, {
      xPercent: -50,
      yPercent: -50,
      x: lastPos.current.x,
      y: lastPos.current.y,
      transformOrigin: "50% 50%",
      autoAlpha: 0,
      scale: 0.001,
      force3D: true,
    });

    const setX = gsap.quickSetter(wrap, "x", "px");
    const setY = gsap.quickSetter(wrap, "y", "px");
    const rootCursorScale = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--cursor-hover-scale")
    );
    const hoverScale = Number.isFinite(rootCursorScale) && rootCursorScale > 0 ? rootCursorScale : 1.8;
    const setDotScale = gsap.quickTo(dot, "scale", {
      duration: safariRef.current ? 0.09 : 0.14,
      ease: safariRef.current ? "none" : "power3.out",
      overwrite: "auto",
    });

    const setHovered = (v: boolean) => {
      if (!wrapRef.current) return;
      if (hoveredRef.current === v) return;
      hoveredRef.current = v;
      wrapRef.current.dataset.hovered = v ? "true" : "false";
      setDotScale(v ? hoverScale : 1);
    };

    const flushMove = () => {
      moveRafRef.current = null;
      if (!hasPendingMoveRef.current) return;
      hasPendingMoveRef.current = false;
      const x = pendingPosRef.current.x;
      const y = pendingPosRef.current.y;
      setX(x);
      setY(y);
      const target = pendingTargetRef.current;
      setHovered(!!resolveInteractive(target));
      show();
    };

    const pendingTargetRef = { current: null as HTMLElement | null };

    const handleMove = (e: any) => {
      const pt = (e?.pointerType as string | undefined) ?? "mouse";
      if (pt && pt !== "mouse") {
        if (moveRafRef.current != null) {
          window.cancelAnimationFrame(moveRafRef.current);
          moveRafRef.current = null;
        }
        hasPendingMoveRef.current = false;
        reset(true);
        return;
      }

      const x = e.clientX ?? 0;
      const y = e.clientY ?? 0;

      hasMovedRef.current = true;
      lastPos.current.x = x;
      lastPos.current.y = y;
      pendingPosRef.current.x = x;
      pendingPosRef.current.y = y;
      const rawTarget = e.target;
      pendingTargetRef.current = rawTarget instanceof HTMLElement ? rawTarget : null;
      hasPendingMoveRef.current = true;
      if (moveRafRef.current == null) {
        moveRafRef.current = window.requestAnimationFrame(flushMove);
      }
    };

    const onFocusIn = (e: Event) => {
      const target = e.target as HTMLElement | null;
      setHovered(!!resolveInteractive(target));
    };

    const onFocusOut = (e: Event) => {
      const rel = (e as FocusEvent).relatedTarget as HTMLElement | null;
      setHovered(!!resolveInteractive(rel));
    };

    const usePointerEvents = "PointerEvent" in window;
    const moveEvent = usePointerEvents && !safariRef.current ? "pointermove" : "mousemove";

    const onResize = () => {
      if (!wrapRef.current) return;
      safariRef.current = isSafariBrowser();
      if (safariRef.current) wrapRef.current.dataset.safari = "true";
      else delete wrapRef.current.dataset.safari;
      if (!isFinePointer()) {
        gsap.set(wrapRef.current, { display: "none" });
        setRootActive(false);
        return;
      }
      gsap.set(wrapRef.current, { display: "block" });
    };

    const onBlur = () => {
      setHovered(false);
      reset(true);
    };
    const onVis = () => {
      if (document.visibilityState !== "visible") {
        setHovered(false);
        reset(true);
      }
    };

    const onShowEvent = () => {
      if (hasMovedRef.current) show();
    };

    const onHideEvent = () => {
      setHovered(false);
      reset(true);
    };

    document.addEventListener(moveEvent, handleMove as EventListener, {
      passive: true,
      capture: true,
    });
    document.addEventListener("focusin", onFocusIn as EventListener, { passive: true, capture: true });
    document.addEventListener("focusout", onFocusOut as EventListener, { passive: true, capture: true });

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", onResize, { passive: true });

    window.addEventListener(APP_EVENTS.UI_CURSOR_SHOW, onShowEvent);
    window.addEventListener(APP_EVENTS.UI_CURSOR_HIDE, onHideEvent);

    reset(true);

    return () => {
      if (moveRafRef.current != null) {
        window.cancelAnimationFrame(moveRafRef.current);
        moveRafRef.current = null;
      }
      hasPendingMoveRef.current = false;
      gsap.killTweensOf(dot);

      document.removeEventListener(moveEvent, handleMove as EventListener, true);
      document.removeEventListener("focusin", onFocusIn as EventListener, true);
      document.removeEventListener("focusout", onFocusOut as EventListener, true);

      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);

      window.removeEventListener(APP_EVENTS.UI_CURSOR_SHOW, onShowEvent);
      window.removeEventListener(APP_EVENTS.UI_CURSOR_HIDE, onHideEvent);

      setRootActive(false);
    };
  }, [reset, show]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      data-cursor-ui
      data-hovered="false"
      className="cursor-wrap fixed left-0 top-0 z-[2147483647] pointer-events-none"
      style={{
        width: size,
        height: size,
        isolation: "isolate",
        backfaceVisibility: "hidden",
        willChange: "transform,opacity",
        opacity: 0,
        transform: "translate3d(-9999px,-9999px,0) scale(0.001)",
      }}
    >
      <div
        ref={dotRef}
        className="cursor-dot absolute inset-0 rounded-full"
        style={{ borderRadius: "9999px" }}
      />
    </div>
  );
}
