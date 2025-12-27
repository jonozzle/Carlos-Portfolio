// lib/scroll-state.ts
"use client";

import { gsap } from "gsap";

const KEY = "scroll-state-v2";

type ScrollMap = Record<string, number>;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readMap(): ScrollMap {
  if (typeof window === "undefined") return {};
  return safeParse<ScrollMap>(window.sessionStorage.getItem(KEY), {});
}

function writeMap(map: ScrollMap) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function normalizePath(path: string) {
  const i = path.indexOf("#");
  return i >= 0 ? path.slice(0, i) : path;
}

function getSmoother(): any | null {
  try {
    const ScrollSmoother = (gsap as any)?.core?.globals?.("ScrollSmoother");
    return ScrollSmoother?.get?.() ?? null;
  } catch {
    return null;
  }
}

export function getCurrentScrollY(): number {
  if (typeof window === "undefined") return 0;

  const smoother = getSmoother();
  if (smoother && typeof smoother.scrollTop === "function") {
    const y = smoother.scrollTop();
    if (Number.isFinite(y)) return y;
  }

  return window.scrollY || 0;
}

export function setCurrentScrollY(y: number) {
  if (typeof window === "undefined") return;

  const v = Number.isFinite(y) ? Math.max(0, y) : 0;

  const smoother = getSmoother();
  if (smoother && typeof smoother.scrollTop === "function") {
    smoother.scrollTop(v);
    return;
  }

  window.scrollTo(0, v);
}

export function saveScrollForPath(path: string) {
  if (typeof window === "undefined") return;

  const key = normalizePath(path);
  const map = readMap();
  map[key] = getCurrentScrollY();
  writeMap(map);
}

export function getScrollForPath(path: string): number | null {
  if (typeof window === "undefined") return null;

  const key = normalizePath(path);
  const map = readMap();
  const v = map[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function clearScrollForPath(path: string) {
  if (typeof window === "undefined") return;

  const key = normalizePath(path);
  const map = readMap();
  delete map[key];
  writeMap(map);
}
