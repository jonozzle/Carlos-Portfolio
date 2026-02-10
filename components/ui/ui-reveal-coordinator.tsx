// components/ui/ui-reveal-coordinator.tsx
"use client";

import { useEffect, useRef } from "react";
import { useLoader } from "@/components/loader/loader-context";
import { APP_EVENTS } from "@/lib/app-events";

function emit(name: string) {
  try {
    window.dispatchEvent(new Event(name));
  } catch {
    // ignore
  }
}

/**
 * Single place that turns global UI elements on/off based on loader state.
 * Keeps Cursor + Bookmark logic consistent without coupling them to the loader implementation.
 */
export default function UiRevealCoordinator() {
  const { loaderDone } = useLoader();
  const lastRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const next = !!loaderDone;
    if (lastRef.current === next) return;
    lastRef.current = next;

    // Let layout settle a beat so transforms don’t “jump” on first paint.
    const fire = () => {
      if (next) {
        emit(APP_EVENTS.UI_CURSOR_SHOW);
        emit(APP_EVENTS.UI_BOOKMARK_SHOW);
      } else {
        // Keep custom cursor active during the loader; only hide bookmark UI.
        emit(APP_EVENTS.UI_CURSOR_SHOW);
        emit(APP_EVENTS.UI_BOOKMARK_HIDE);
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(fire));
  }, [loaderDone]);

  return null;
}
