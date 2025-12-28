// lib/scroll-state.ts
"use client";

import ScrollSmoother from "gsap/ScrollSmoother";

type Store = Map<string, number>;

const mem: Store = new Map();
const KEY = "__scrollByPath_v1";

function readSmootherY(): number | null {
  try {
    const s = ScrollSmoother.get();
    if (!s) return null;
    // ScrollSmoother API: scrollTop() returns current scroll position
    const y = s.scrollTop();
    return typeof y === "number" && Number.isFinite(y) ? y : null;
  } catch {
    return null;
  }
}

export function getCurrentScrollY(): number {
  const sy = readSmootherY();
  if (sy != null) return sy;
  if (typeof window === "undefined") return 0;
  return window.scrollY || 0;
}

export function setCurrentScrollY(y: number) {
  const yy = Number.isFinite(y) ? Math.max(0, y) : 0;

  try {
    const s = ScrollSmoother.get();
    if (s) s.scrollTo(yy, false);
  } catch {
    // ignore
  }

  try {
    if (typeof window !== "undefined") window.scrollTo(0, yy);
  } catch {
    // ignore
  }
}

function loadPersisted(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function persistNow() {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, number> = loadPersisted();
    for (const [k, v] of mem.entries()) obj[k] = v;
    window.sessionStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

export function saveScrollForPath(path: string, yOverride?: number) {
  const y = typeof yOverride === "number" ? yOverride : getCurrentScrollY();
  const yy = Number.isFinite(y) ? Math.max(0, y) : 0;

  mem.set(path, yy);

  // Persist asynchronously to avoid end-of-scroll hitches.
  try {
    requestAnimationFrame(() => persistNow());
  } catch {
    persistNow();
  }
}

export function getScrollForPath(path: string): number | null {
  const fromMem = mem.get(path);
  if (typeof fromMem === "number") return fromMem;

  const obj = loadPersisted();
  const v = obj[path];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
