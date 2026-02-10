// components/cursor.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
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

  const lastPos = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });

  const reset = useCallback((moveOffscreen: boolean) => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    shownRef.current = false;
    setRootActive(false);

    gsap.killTweensOf(wrap);

    wrap.dataset.hovered = "false";

    gsap.set(wrap, {
      autoAlpha: 0,
      scale: 0.001,
      x: moveOffscreen ? -9999 : lastPos.current.x,
      y: moveOffscreen ? -9999 : lastPos.current.y,
    });
  }, []);

  const show = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (shownRef.current) return;

    shownRef.current = true;
    setRootActive(true);

    gsap.killTweensOf(wrap);
    gsap.to(wrap, {
      autoAlpha: 1,
      scale: 1,
      duration: 0.16,
      ease: "power3.out",
      overwrite: "auto",
    });
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (typeof window === "undefined") return;

    if (!isFinePointer()) {
      gsap.set(wrap, { display: "none" });
      setRootActive(false);
      return;
    }

    gsap.set(wrap, {
      xPercent: -50,
      yPercent: -50,
      x: lastPos.current.x,
      y: lastPos.current.y,
      transformOrigin: "50% 50%",
      autoAlpha: 0,
      scale: 0.001,
    });

    const setX = gsap.quickSetter(wrap, "x", "px");
    const setY = gsap.quickSetter(wrap, "y", "px");

    const handleMove = (e: any) => {
      const pt = (e?.pointerType as string | undefined) ?? "mouse";
      if (pt && pt !== "mouse") {
        reset(true);
        return;
      }

      const x = e.clientX ?? 0;
      const y = e.clientY ?? 0;

      hasMovedRef.current = true;
      lastPos.current = { x, y };

      setX(x);
      setY(y);

      show();
    };

    const boundRef = new Set<HTMLElement>();

    const setHovered = (v: boolean) => {
      if (!wrapRef.current) return;
      wrapRef.current.dataset.hovered = v ? "true" : "false";
    };

    const onEnter = (e: Event) => {
      const el = resolveInteractive(e.currentTarget as HTMLElement | null);
      if (el) setHovered(true);
    };

    const onLeave = (e: Event) => {
      const rel = (e as MouseEvent).relatedTarget as HTMLElement | null;
      const next = resolveInteractive(rel);
      setHovered(!!next);
    };

    const bindElement = (el: HTMLElement) => {
      if (boundRef.has(el)) return;
      boundRef.add(el);
      el.addEventListener("mouseenter", onEnter, { passive: true });
      el.addEventListener("mouseleave", onLeave, { passive: true });
      el.addEventListener("focus", onEnter, { passive: true });
      el.addEventListener("blur", onLeave, { passive: true });
    };

    const scanInteractive = () => {
      const nodes = document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR);
      nodes.forEach(bindElement);
    };

    scanInteractive();

    const mo = new MutationObserver(() => {
      scanInteractive();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    const onBlur = () => reset(true);
    const onVis = () => {
      if (document.visibilityState !== "visible") reset(true);
    };

    const onShowEvent = () => {
      if (hasMovedRef.current) show();
    };

    const onHideEvent = () => reset(true);

    document.addEventListener("pointermove", handleMove as EventListener, {
      passive: true,
      capture: true,
    });
    document.addEventListener("mousemove", handleMove as EventListener, {
      passive: true,
      capture: true,
    });

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);

    window.addEventListener(APP_EVENTS.UI_CURSOR_SHOW, onShowEvent);
    window.addEventListener(APP_EVENTS.UI_CURSOR_HIDE, onHideEvent);

    reset(true);

    return () => {
      mo.disconnect();

      document.removeEventListener("pointermove", handleMove as EventListener, true);
      document.removeEventListener("mousemove", handleMove as EventListener, true);

      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);

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
      <div ref={dotRef} className="cursor-dot absolute inset-0 rounded-full" />
    </div>
  );
}
