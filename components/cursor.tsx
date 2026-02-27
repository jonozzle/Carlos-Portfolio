// components/cursor.tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { APP_EVENTS } from "@/lib/app-events";

const ROOT_SELECTOR = ".has-custom-cursor";
const ACTIVE_CLASS = "custom-cursor-active";
const INTERACTIVE_SELECTOR =
  "[data-cursor-scale],[data-cursor],a,button,[role='button'],input,textarea,select,label,summary,.cursor-pointer";
const INTERACTIVE_HOVER_SELECTOR =
  "[data-cursor-scale]:hover,[data-cursor]:hover,a:hover,button:hover,[role='button']:hover,input:hover,textarea:hover,select:hover,label:hover,summary:hover,.cursor-pointer:hover";
const CURSOR_SCALE_MIN = 1;
const CURSOR_SCALE_MAX = 2.6;

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
  if (el.closest("[data-cursor-ui]")) return null;
  return el.closest<HTMLElement>(INTERACTIVE_SELECTOR);
}

function resolveCursorTone(el: HTMLElement | null): string | null {
  if (!el) return null;
  if (el.closest("[data-cursor-ui]")) return null;
  const toneEl = el.closest<HTMLElement>("[data-cursor-tone]");
  if (!toneEl) return null;
  const tone = toneEl.getAttribute("data-cursor-tone");
  return tone && tone.trim().length > 0 ? tone.trim() : null;
}

function resolveCursorScale(el: HTMLElement | null, fallback: number): number {
  if (!el) return fallback;
  const scaleEl = el.closest<HTMLElement>("[data-cursor-scale]");
  if (!scaleEl) return fallback;
  const raw = scaleEl.getAttribute("data-cursor-scale");
  const parsed = raw ? Number.parseFloat(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(CURSOR_SCALE_MIN, Math.min(CURSOR_SCALE_MAX, parsed));
}

function resolveInteractiveFromStack(stack: HTMLElement[]): HTMLElement | null {
  for (const el of stack) {
    const interactive = resolveInteractive(el);
    if (interactive) return interactive;
  }
  return null;
}

function resolveToneFromStack(stack: HTMLElement[]): string | null {
  for (const el of stack) {
    const tone = resolveCursorTone(el);
    if (tone) return tone;
  }
  return null;
}

function resolveElementsAtPoint(x: number, y: number): HTMLElement[] {
  if (typeof document === "undefined") return [];
  if (typeof document.elementsFromPoint === "function") {
    return document.elementsFromPoint(x, y).filter((n): n is HTMLElement => n instanceof HTMLElement);
  }
  const single = document.elementFromPoint(x, y);
  return single instanceof HTMLElement ? [single] : [];
}

function resolveInteractiveFromHovered(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const hovered = document.querySelectorAll(":hover");
  for (let i = hovered.length - 1; i >= 0; i -= 1) {
    const n = hovered[i];
    if (!(n instanceof HTMLElement)) continue;
    const interactive = resolveInteractive(n);
    if (interactive) return interactive;
  }
  return null;
}

function resolveToneFromHovered(): string | null {
  if (typeof document === "undefined") return null;
  const hovered = document.querySelectorAll(":hover");
  for (let i = hovered.length - 1; i >= 0; i -= 1) {
    const n = hovered[i];
    if (!(n instanceof HTMLElement)) continue;
    const tone = resolveCursorTone(n);
    if (tone) return tone;
  }
  return null;
}

function resolveInteractiveFromHoverSelector(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const hovered = document.querySelector<HTMLElement>(INTERACTIVE_HOVER_SELECTOR);
  if (!hovered) return null;
  return resolveInteractive(hovered);
}

function resolveEventElement(e: Event | any): HTMLElement | null {
  if (!e) return null;
  const path =
    typeof e.composedPath === "function" ? (e.composedPath() as EventTarget[]) : null;
  if (Array.isArray(path)) {
    for (const node of path) {
      if (node instanceof HTMLElement) return node;
    }
  }
  const rawTarget = e.target;
  return rawTarget instanceof HTMLElement ? rawTarget : null;
}

export default function Cursor({
  size = 12,
  growScale,
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
  const toneRef = useRef<string>("default");
  const dotScaleRef = useRef(1);

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
      gsap.set(dot, { scale: 1 });
      dotScaleRef.current = 1;
    }

    wrap.dataset.hovered = "false";
    wrap.dataset.tone = "default";
    toneRef.current = "default";

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
    const cssScale = Number.isFinite(rootCursorScale) && rootCursorScale > 0 ? rootCursorScale : 1.8;
    const inputHoverScale =
      Number.isFinite(growScale) && (growScale as number) > 0 ? (growScale as number) : cssScale;
    const defaultHoverScale = Math.max(CURSOR_SCALE_MIN, Math.min(CURSOR_SCALE_MAX, inputHoverScale));
    gsap.set(dot, { scale: 1, transformOrigin: "50% 50%" });

    const setHovered = (v: boolean, targetScale = defaultHoverScale) => {
      if (!wrapRef.current) return;
      const nextScale = v ? targetScale : 1;
      const sameState = hoveredRef.current === v;
      const sameScale = Math.abs(dotScaleRef.current - nextScale) < 0.001;
      if (sameState && sameScale) return;
      hoveredRef.current = v;
      wrapRef.current.dataset.hovered = v ? "true" : "false";
      dotScaleRef.current = nextScale;
      gsap.to(dot, {
        scale: nextScale,
        duration: safariRef.current ? 0.12 : 0.17,
        ease: safariRef.current ? "none" : "power3.out",
        overwrite: "auto",
      });
    };

    const setTone = (tone: string | null) => {
      const next = tone ?? "default";
      if (!wrapRef.current) return;
      if (toneRef.current === next) return;
      toneRef.current = next;
      wrapRef.current.dataset.tone = next;
    };

    const flushMove = () => {
      moveRafRef.current = null;
      if (!hasPendingMoveRef.current) return;
      hasPendingMoveRef.current = false;
      const x = pendingPosRef.current.x;
      const y = pendingPosRef.current.y;
      setX(x);
      setY(y);
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
      const eventTarget = resolveEventElement(e);
      pendingTargetRef.current = eventTarget;
      const stack = resolveElementsAtPoint(x, y);
      const selectorInteractive = resolveInteractiveFromHoverSelector();
      const stackInteractive = resolveInteractiveFromStack(stack);
      const eventInteractive = resolveInteractive(eventTarget);
      const hoverInteractive = resolveInteractiveFromHovered();
      const interactive =
        selectorInteractive ?? eventInteractive ?? stackInteractive ?? hoverInteractive;
      const targetScale = resolveCursorScale(interactive, defaultHoverScale);
      setHovered(!!interactive, targetScale);
      const tone =
        resolveCursorTone(eventTarget) ??
        resolveToneFromStack(stack) ??
        resolveToneFromHovered();
      setTone(tone);
      hasPendingMoveRef.current = true;
      if (moveRafRef.current == null) {
        moveRafRef.current = window.requestAnimationFrame(flushMove);
      }
    };

    const onOver = (e: Event | any) => {
      const target = resolveEventElement(e);
      const interactive = resolveInteractive(target) ?? resolveInteractiveFromHoverSelector();
      const targetScale = resolveCursorScale(interactive, defaultHoverScale);
      setHovered(!!interactive, targetScale);
      setTone(resolveCursorTone(target) ?? resolveToneFromHovered());
    };

    const onOut = (e: Event | any) => {
      const rel = e?.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
      const interactive = resolveInteractive(rel) ?? resolveInteractiveFromHoverSelector();
      const targetScale = resolveCursorScale(interactive, defaultHoverScale);
      setHovered(!!interactive, targetScale);
      setTone(resolveCursorTone(rel) ?? resolveToneFromHovered());
    };

    const onFocusIn = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const interactive = resolveInteractive(target) ?? resolveInteractiveFromHoverSelector();
      const targetScale = resolveCursorScale(interactive, defaultHoverScale);
      setHovered(!!interactive, targetScale);
      setTone(resolveCursorTone(target));
    };

    const onFocusOut = (e: Event) => {
      const rel = (e as FocusEvent).relatedTarget as HTMLElement | null;
      const interactive = resolveInteractive(rel) ?? resolveInteractiveFromHoverSelector();
      const targetScale = resolveCursorScale(interactive, defaultHoverScale);
      setHovered(!!interactive, targetScale);
      setTone(resolveCursorTone(rel));
    };

    const usePointerEvents = "PointerEvent" in window;
    const moveEvent = usePointerEvents && !safariRef.current ? "pointermove" : "mousemove";
    const overEvent = usePointerEvents ? "pointerover" : "mouseover";
    const outEvent = usePointerEvents ? "pointerout" : "mouseout";

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
      setTone(null);
      reset(true);
    };
    const onVis = () => {
      if (document.visibilityState !== "visible") {
        setHovered(false);
        setTone(null);
        reset(true);
      }
    };

    const onShowEvent = () => {
      if (hasMovedRef.current) show();
    };

    const onHideEvent = () => {
      setHovered(false);
      setTone(null);
      reset(true);
    };

    document.addEventListener(moveEvent, handleMove as EventListener, {
      passive: true,
      capture: true,
    });
    document.addEventListener(overEvent, onOver as EventListener, { passive: true, capture: true });
    document.addEventListener(outEvent, onOut as EventListener, { passive: true, capture: true });
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
      document.removeEventListener(overEvent, onOver as EventListener, true);
      document.removeEventListener(outEvent, onOut as EventListener, true);
      document.removeEventListener("focusin", onFocusIn as EventListener, true);
      document.removeEventListener("focusout", onFocusOut as EventListener, true);

      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);

      window.removeEventListener(APP_EVENTS.UI_CURSOR_SHOW, onShowEvent);
      window.removeEventListener(APP_EVENTS.UI_CURSOR_HIDE, onHideEvent);

      setRootActive(false);
    };
  }, [growScale, reset, show]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      data-cursor-ui
      data-hovered="false"
      data-tone="default"
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
