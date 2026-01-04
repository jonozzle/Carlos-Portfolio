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
    (e: PointerEvent) => {
      const path = (e.composedPath?.() as EventTarget[]) || [];
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

  const hide = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    if (!shownRef.current) {
      // Still ensure OS cursor can show
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
      if (!hasMovedRef.current) return false;
      if (staleRef.current) return false;
      return true;
    };

    const deactivateToNative = () => {
      // Don’t hide OS cursor unless we’re actively tracking.
      setRootActive(false);
      hide();
    };

    const activateIfReady = () => {
      if (canUseCustomNow()) {
        // Ensure we’re at last known pos (fresh) before showing
        gsap.set(wrap, { x: lastPos.current.x, y: lastPos.current.y });
        show();
      } else {
        deactivateToNative();
      }
    };

    const onMove = (e: PointerEvent) => {
      // Only treat mouse as “custom cursor capable”
      if (e.pointerType && e.pointerType !== "mouse") {
        staleRef.current = true;
        deactivateToNative();
        return;
      }

      hasMovedRef.current = true;
      staleRef.current = false;

      lastPos.current = { x: e.clientX, y: e.clientY };

      // If we were hidden, snap immediately to avoid animating from offscreen
      if (!shownRef.current) {
        gsap.set(wrap, { x: e.clientX, y: e.clientY });
      } else {
        xTo(e.clientX);
        yTo(e.clientY);
      }

      // Show/hide depending on current app state
      if (loaderDone && document.visibilityState === "visible") {
        show();
      } else {
        deactivateToNative();
      }

      const s = findScaleFromEvent(e);
      gsap.to(dot, {
        scale: s,
        duration: 0.14,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    const onPointerOver = (e: PointerEvent) => {
      // Helps when entering document; pointerenter doesn’t bubble
      if (e.pointerType && e.pointerType !== "mouse") return;
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const onBlur = () => {
      staleRef.current = true;
      deactivateToNative();
    };

    const onFocus = () => {
      // We still cannot know the real pointer position until a move happens,
      // so we intentionally keep native cursor until the next pointermove.
      staleRef.current = true;
      deactivateToNative();
    };

    const onVis = () => {
      if (document.visibilityState !== "visible") {
        staleRef.current = true;
        deactivateToNative();
        return;
      }
      // Becoming visible: keep native cursor until fresh move.
      staleRef.current = true;
      deactivateToNative();
    };

    const onShowEvent = () => {
      // Same rule: don’t hide OS cursor unless we have fresh position
      activateIfReady();
    };

    const onHideEvent = () => {
      staleRef.current = true;
      deactivateToNative();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    // pointerover bubbles; pointerenter does not (unless capture)
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener(
      "pointerenter",
      onPointerOver as unknown as EventListener,
      { passive: true, capture: true }
    );

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    window.addEventListener(APP_EVENTS.UI_CURSOR_SHOW, onShowEvent);
    window.addEventListener(APP_EVENTS.UI_CURSOR_HIDE, onHideEvent);

    // Initial state: native cursor until we get a fresh move.
    staleRef.current = true;
    deactivateToNative();

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener(
        "pointerenter",
        onPointerOver as unknown as EventListener,
        true as unknown as AddEventListenerOptions
      );

      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);

      window.removeEventListener(APP_EVENTS.UI_CURSOR_SHOW, onShowEvent);
      window.removeEventListener(APP_EVENTS.UI_CURSOR_HIDE, onHideEvent);

      setRootActive(false);
    };
  }, [findScaleFromEvent, hide, show, loaderDone]);

  // Loader guard: if loader toggles, force native until next move
  useEffect(() => {
    if (!wrapRef.current) return;
    if (!loaderDone) {
      staleRef.current = true;
      setRootActive(false);
      hide();
      return;
    }
    // When loader completes, still require a fresh move if we’re stale.
    if (staleRef.current) {
      setRootActive(false);
      hide();
    }
  }, [loaderDone, hide]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="fixed left-0 top-0 z-[2147483647] pointer-events-none"
      style={{
        width: size,
        height: size,
        isolation: "isolate",
        contain: "layout paint",
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
