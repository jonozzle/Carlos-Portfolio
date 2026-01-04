// components/cursor.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import { APP_EVENTS } from "@/lib/app-events";
import { useLoader } from "@/components/loader/loader-context";

const ROOT_SELECTOR = ".has-custom-cursor";
const ACTIVE_CLASS = "custom-cursor-active";

function isFinePointer() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    window.matchMedia("(pointer: fine)").matches &&
    window.matchMedia("(hover: hover)").matches
  );
}

function clampScale(n: number, fallback = 1) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0.25, Math.min(6, v));
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

export default function Cursor({
  size = 10,
  growScale = 1.8,
}: {
  size?: number;
  growScale?: number;
}) {
  const { loaderDone } = useLoader();

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);

  const shownRef = useRef(false);
  const hasMovedRef = useRef(false);

  // When the page loses focus/visibility, we consider the last position untrusted.
  const staleRef = useRef(true);

  const lastPos = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });

  const baseGrow = useMemo(() => clampScale(growScale, 1.8), [growScale]);

  const findScaleFromEvent = useCallback(
    (e: Event) => {
      const pe = e as any;
      const path = (pe.composedPath?.() as EventTarget[]) || [];
      for (const p of path) {
        if (!(p instanceof HTMLElement)) continue;

        const scaleAttr =
          p.closest<HTMLElement>("[data-cursor-scale]")?.dataset.cursorScale;
        if (scaleAttr) return clampScale(parseFloat(scaleAttr), baseGrow);

        const cursorFlag = p.closest<HTMLElement>("[data-cursor]");
        if (cursorFlag) return baseGrow;

        const interactive = p.closest<HTMLElement>(
          'a, button, [role="button"], input, textarea, select, label'
        );
        if (interactive) return baseGrow;
      }
      return 1;
    },
    [baseGrow]
  );

  const hardResetToNative = useCallback((moveOffscreen: boolean) => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    shownRef.current = false;
    setRootActive(false);

    gsap.killTweensOf(wrap);

    gsap.set(wrap, {
      autoAlpha: 0,
      scale: 0.001,
      x: moveOffscreen ? -9999 : lastPos.current.x,
      y: moveOffscreen ? -9999 : lastPos.current.y,
    });
  }, []);

  const hideSoft = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    if (!shownRef.current) {
      setRootActive(false);
      return;
    }

    shownRef.current = false;
    setRootActive(false);

    gsap.killTweensOf(wrap);
    gsap.to(wrap, {
      autoAlpha: 0,
      scale: 0.001,
      duration: 0.18,
      ease: "power2.in",
      overwrite: "auto",
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
      duration: 0.24,
      ease: "power3.out",
      overwrite: "auto",
    });
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const dot = dotRef.current;
    if (!wrap || !dot) return;
    if (typeof window === "undefined") return;

    // Hard-disable on non-fine pointers
    if (!isFinePointer()) {
      gsap.set(wrap, { display: "none" });
      setRootActive(false);
      return;
    }

    // Baseline
    gsap.set(wrap, {
      xPercent: -50,
      yPercent: -50,
      x: lastPos.current.x,
      y: lastPos.current.y,
      transformOrigin: "50% 50%",
      autoAlpha: 0,
      scale: 0.001,
    });
    gsap.set(dot, { scale: 1, transformOrigin: "50% 50%" });

    const xTo = gsap.quickTo(wrap, "x", { duration: 0.22, ease: "power3.out" });
    const yTo = gsap.quickTo(wrap, "y", { duration: 0.22, ease: "power3.out" });

    const canUseCustomNow = () => {
      if (!loaderDone) return false;
      if (document.visibilityState !== "visible") return false;
      if (!document.hasFocus()) return false;
      if (!hasMovedRef.current) return false;
      if (staleRef.current) return false;
      return true;
    };

    const deactivateToNativeHard = (moveOffscreen: boolean) => {
      staleRef.current = true;
      hardResetToNative(moveOffscreen);
    };

    const activateIfReady = () => {
      if (canUseCustomNow()) {
        gsap.set(wrap, { x: lastPos.current.x, y: lastPos.current.y });
        show();
      } else {
        deactivateToNativeHard(false);
      }
    };

    const handleMove = (e: any) => {
      const pt = (e?.pointerType as string | undefined) ?? "mouse";
      if (pt && pt !== "mouse") {
        deactivateToNativeHard(true);
        return;
      }

      const x = e.clientX ?? 0;
      const y = e.clientY ?? 0;

      hasMovedRef.current = true;
      staleRef.current = false;

      lastPos.current = { x, y };

      if (!shownRef.current) {
        gsap.set(wrap, { x, y });
      } else {
        xTo(x);
        yTo(y);
      }

      // Only hide OS cursor when we’re truly active and focused/visible
      if (loaderDone && document.visibilityState === "visible" && document.hasFocus()) {
        show();
      } else {
        deactivateToNativeHard(false);
      }

      const s = findScaleFromEvent(e);
      gsap.to(dot, {
        scale: s,
        duration: 0.14,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    const onPointerOver = (e: any) => {
      const pt = (e?.pointerType as string | undefined) ?? "mouse";
      if (pt && pt !== "mouse") return;
      lastPos.current = { x: e.clientX ?? lastPos.current.x, y: e.clientY ?? lastPos.current.y };
    };

    const onBlur = () => deactivateToNativeHard(true);
    const onFocus = () => deactivateToNativeHard(true);

    const onVis = () => {
      // Any visibility flip: force native + require fresh move next
      deactivateToNativeHard(true);
    };

    const onPageHide = () => deactivateToNativeHard(true);
    const onPageShow = () => deactivateToNativeHard(true);

    const onShowEvent = () => activateIfReady();
    const onHideEvent = () => deactivateToNativeHard(true);

    // CAPTURE listeners so stopPropagation() in the tree can’t block us.
    document.addEventListener("pointermove", handleMove as EventListener, {
      passive: true,
      capture: true,
    });
    document.addEventListener("pointerrawupdate", handleMove as EventListener, {
      passive: true,
      capture: true,
    });
    document.addEventListener("mousemove", handleMove as EventListener, {
      passive: true,
      capture: true,
    });

    document.addEventListener("pointerover", onPointerOver as EventListener, {
      passive: true,
      capture: true,
    });
    document.addEventListener("pointerenter", onPointerOver as EventListener, {
      passive: true,
      capture: true,
    });

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    window.addEventListener(APP_EVENTS.UI_CURSOR_SHOW, onShowEvent);
    window.addEventListener(APP_EVENTS.UI_CURSOR_HIDE, onHideEvent);

    // Initial: force native until we get a fresh move
    deactivateToNativeHard(true);

    return () => {
      document.removeEventListener("pointermove", handleMove as EventListener, true);
      document.removeEventListener("pointerrawupdate", handleMove as EventListener, true);
      document.removeEventListener("mousemove", handleMove as EventListener, true);

      document.removeEventListener("pointerover", onPointerOver as EventListener, true);
      document.removeEventListener("pointerenter", onPointerOver as EventListener, true);

      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);

      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);

      window.removeEventListener(APP_EVENTS.UI_CURSOR_SHOW, onShowEvent);
      window.removeEventListener(APP_EVENTS.UI_CURSOR_HIDE, onHideEvent);

      setRootActive(false);
    };
  }, [findScaleFromEvent, hardResetToNative, hideSoft, show, loaderDone]);

  // Loader guard: if loader toggles, force native until next move
  useEffect(() => {
    if (!wrapRef.current) return;
    if (!loaderDone) {
      staleRef.current = true;
      hardResetToNative(true);
      return;
    }
    // When loader completes, still require a fresh move if we’re stale.
    if (staleRef.current) {
      hardResetToNative(true);
    }
  }, [loaderDone, hardResetToNative]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="fixed left-0 top-0 z-[2147483647] pointer-events-none"
      style={{
        width: size,
        height: size,
        isolation: "isolate",
        contain: "paint",
        backfaceVisibility: "hidden",
        willChange: "transform,opacity",
        opacity: 0,
        transform: "translate3d(-9999px,-9999px,0) scale(0.001)",
      }}
    >
      <div
        ref={dotRef}
        className="absolute inset-0 rounded-full"
        style={{ background: "red" }}
      />
    </div>
  );
}
