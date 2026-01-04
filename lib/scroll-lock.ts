// lib/scroll-lock.ts
"use client";

type LockState = {
  wheel: (e: WheelEvent) => void;
  touch: (e: TouchEvent) => void;
  key: (e: KeyboardEvent) => void;
};

declare global {
  interface Window {
    __appScrollLockCount?: number;
    __appScrollLockState?: LockState;
  }
}

const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

export function lockAppScroll() {
  if (typeof window === "undefined") return;

  const next = (window.__appScrollLockCount ?? 0) + 1;
  window.__appScrollLockCount = next;

  if (next > 1) return;

  const wheel = (e: WheelEvent) => e.preventDefault();
  const touch = (e: TouchEvent) => e.preventDefault();
  const key = (e: KeyboardEvent) => {
    if (SCROLL_KEYS.has(e.key)) e.preventDefault();
  };

  window.__appScrollLockState = { wheel, touch, key };

  window.addEventListener("wheel", wheel, { passive: false, capture: true });
  window.addEventListener("touchmove", touch, { passive: false, capture: true });
  window.addEventListener("keydown", key, { passive: false, capture: true });
}

export function unlockAppScroll() {
  if (typeof window === "undefined") return;

  const curr = window.__appScrollLockCount ?? 0;
  const next = Math.max(0, curr - 1);
  window.__appScrollLockCount = next;

  if (next > 0) return;

  const st = window.__appScrollLockState;
  window.__appScrollLockState = undefined;

  if (st) {
    window.removeEventListener("wheel", st.wheel as any, { capture: true } as any);
    window.removeEventListener("touchmove", st.touch as any, { capture: true } as any);
    window.removeEventListener("keydown", st.key as any, { capture: true } as any);
  }
}
