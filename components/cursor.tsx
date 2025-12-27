// components/cursor.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";

type Variant = "default" | "link" | "image" | "button";

const isCoarse = () => window.matchMedia("(pointer: coarse)").matches;

export default function Cursor({ size = 10 }: { size?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastPos = useRef<{ x: number; y: number }>({ x: -1, y: -1 });

  const pathname = usePathname();

  const [variant, setVariant] = useState<Variant>("default");
  const [scale, setScale] = useState<number>(1);

  const lastAppliedRef = useRef<{ v: Variant; s: number }>({
    v: "default",
    s: 1,
  });

  const stateRafRef = useRef<number | null>(null);

  const findCursorTargetFromEvent = useCallback((e: PointerEvent) => {
    const path = (e.composedPath?.() as Element[]) || [];
    for (const el of path) {
      if (!(el instanceof HTMLElement)) continue;
      const t = el.closest<HTMLElement>("[data-cursor]");
      if (t) return t;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el?.closest<HTMLElement>("[data-cursor]") ?? null;
  }, []);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;

    if (isCoarse()) {
      node.style.display = "none";
      return;
    }

    // initial setup
    gsap.set(node, {
      xPercent: -50,
      yPercent: -50,
      transformOrigin: "50% 50%",
      scale: 0.001,
    });

    const xTo = gsap.quickTo(node, "x", { duration: 0.5, ease: "power3" });
    const yTo = gsap.quickTo(node, "y", { duration: 0.5, ease: "power3" });

    const applyState = (next: { v: Variant; s: number }) => {
      if (stateRafRef.current != null) return;
      stateRafRef.current = requestAnimationFrame(() => {
        stateRafRef.current = null;

        const prev = lastAppliedRef.current;
        if (next.v !== prev.v) setVariant(next.v);
        if (next.s !== prev.s) setScale(next.s);

        lastAppliedRef.current = next;
      });
    };

    const onMove = (e: PointerEvent) => {
      lastPos.current = { x: e.clientX, y: e.clientY };
      xTo(e.clientX);
      yTo(e.clientY);

      const target = findCursorTargetFromEvent(e);
      const v = (target?.dataset.cursor as Variant) || "default";

      const sAttr = target?.dataset.cursorScale;

      // Larger defaults
      const newScale =
        sAttr
          ? Number(sAttr)
          : v === "image"
            ? 2.3
            : v === "button"
              ? 1.9
              : v === "link"
                ? 1.6
                : 1;

      applyState({ v, s: newScale });
    };

    const onEnter = (e: PointerEvent) => {
      gsap.set(node, { x: e.clientX, y: e.clientY });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerenter", onEnter);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerenter", onEnter);
    };
  }, [findCursorTargetFromEvent]);

  // Smooth scale animation
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;

    gsap.to(node, {
      scale,
      duration: 0.25,
      ease: "power3.out",
      overwrite: "auto",
    });
  }, [scale]);

  // Position restore on route/visibility
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;

    const restore = () => {
      const p =
        lastPos.current.x >= 0 && lastPos.current.y >= 0
          ? lastPos.current
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      gsap.set(node, {
        x: p.x,
        y: p.y,
        xPercent: -50,
        yPercent: -50,
        scale: lastAppliedRef.current.s,
      });
    };

    const onPageShow = (e: Event & { persisted?: boolean }) => {
      if (e.persisted) restore();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") restore();
    };

    restore();
    window.addEventListener("pageshow", onPageShow as EventListener);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pageshow", onPageShow as EventListener);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="fixed left-0 top-0 z-[2147483647] pointer-events-none vt-none"
      style={{
        width: size,
        height: size,
        isolation: "isolate",
        contain: "layout paint",
        backfaceVisibility: "hidden",
        willChange: "transform",
      }}
      data-variant={variant}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "red",
        }}
      />
    </div>
  );
}
