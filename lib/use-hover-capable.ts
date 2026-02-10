"use client";

import { useEffect, useState } from "react";

function readHoverCapable(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;

  const hover = window.matchMedia("(hover: hover)").matches;
  const anyHover = window.matchMedia("(any-hover: hover)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const anyFinePointer = window.matchMedia("(any-pointer: fine)").matches;

  return (hover || anyHover) && (finePointer || anyFinePointer);
}

export function useHoverCapable() {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const hoverMq = window.matchMedia("(hover: hover)");
    const anyHoverMq = window.matchMedia("(any-hover: hover)");
    const finePointerMq = window.matchMedia("(pointer: fine)");
    const anyFinePointerMq = window.matchMedia("(any-pointer: fine)");

    const update = () => setCapable(readHoverCapable());
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

    [hoverMq, anyHoverMq, finePointerMq, anyFinePointerMq].forEach(bind);

    return () => {
      [hoverMq, anyHoverMq, finePointerMq, anyFinePointerMq].forEach(unbind);
    };
  }, []);

  return capable;
}
