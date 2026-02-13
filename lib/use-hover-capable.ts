"use client";

import { useEffect, useRef, useState } from "react";

function readHoverCapable(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;

  const desktopWidth = window.matchMedia("(min-width: 768px)").matches;
  const hover = window.matchMedia("(hover: hover)").matches;
  const anyHover = window.matchMedia("(any-hover: hover)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const anyFinePointer = window.matchMedia("(any-pointer: fine)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const anyCoarsePointer = window.matchMedia("(any-pointer: coarse)").matches;
  const hasTouchPoints =
    typeof navigator !== "undefined" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 0;

  // Treat any touch-capable environment as non-hover for theme previews.
  if (coarsePointer || anyCoarsePointer || hasTouchPoints) return false;
  if (!desktopWidth) return false;

  return (hover || anyHover) && (finePointer || anyFinePointer);
}

export function useHoverCapable() {
  const [capable, setCapable] = useState(false);
  const lastPointerTypeRef = useRef<string | null>(null);

  const compute = () => {
    const base = readHoverCapable();
    if (!base) return false;

    const pt = lastPointerTypeRef.current;
    if (!pt) return true;
    return pt === "mouse" || pt === "pen";
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const desktopMq = window.matchMedia("(min-width: 768px)");
    const hoverMq = window.matchMedia("(hover: hover)");
    const anyHoverMq = window.matchMedia("(any-hover: hover)");
    const finePointerMq = window.matchMedia("(pointer: fine)");
    const anyFinePointerMq = window.matchMedia("(any-pointer: fine)");
    const coarsePointerMq = window.matchMedia("(pointer: coarse)");
    const anyCoarsePointerMq = window.matchMedia("(any-pointer: coarse)");

    const update = () => setCapable(compute());
    update();

    const bind = (mq: MediaQueryList) => {
      try {
        mq.addEventListener("change", update);
      } catch {
        mq.addListener(update);
      }
    };

    const unbind = (mq: MediaQueryList) => {
      try {
        mq.removeEventListener("change", update);
      } catch {
        mq.removeListener(update);
      }
    };

    const onPointer = (e: PointerEvent) => {
      const pt = e.pointerType || null;
      if (pt) lastPointerTypeRef.current = pt;
      update();
    };

    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });

    [
      desktopMq,
      hoverMq,
      anyHoverMq,
      finePointerMq,
      anyFinePointerMq,
      coarsePointerMq,
      anyCoarsePointerMq,
    ].forEach(bind);

    return () => {
      [
        desktopMq,
        hoverMq,
        anyHoverMq,
        finePointerMq,
        anyFinePointerMq,
        coarsePointerMq,
        anyCoarsePointerMq,
      ].forEach(unbind);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return capable;
}
