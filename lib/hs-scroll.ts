// lib/hs-scroll.ts
"use client";

import ScrollTrigger from "gsap/ScrollTrigger";
import ScrollSmoother from "gsap/ScrollSmoother";

const KEY = "hs-progress:v1:/";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function getST(): ScrollTrigger | null {
  try {
    return (ScrollTrigger.getById("hs-horizontal") as ScrollTrigger) ?? null;
  } catch {
    return null;
  }
}

function readProgress(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? clamp01(n) : null;
  } catch {
    return null;
  }
}

function writeProgress(p: number) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, String(clamp01(p)));
  } catch {
    // ignore
  }
}

function writeScrollTop(y: number) {
  const v = Number.isFinite(y) ? Math.max(0, y) : 0;

  try {
    const smoother = ScrollSmoother.get();
    if (smoother && typeof smoother.scrollTop === "function") {
      smoother.scrollTop(v);
      return;
    }
  } catch {
    // ignore
  }

  window.scrollTo(0, v);
}

export function saveHsProgressNow() {
  const st = getST();
  if (!st) return;
  writeProgress(st.progress);
}

export function getSavedHsProgress(): number | null {
  return readProgress();
}

export function restoreHsProgressNow(progress: number) {
  const st = getST();
  if (!st) return;

  const p = clamp01(progress);
  const start = st.start ?? 0;
  const end = st.end ?? start;

  const y = start + p * (end - start);
  writeScrollTop(y);
}
