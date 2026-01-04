// home-section
// lib/home-section.ts
"use client";

import ScrollTrigger from "gsap/ScrollTrigger";
import { setCurrentScrollY } from "@/lib/scroll-state";

export type SavedHomeSection = {
  id: string;
  type: string;
};

type HomeActiveSection = {
  id: string;
  type: string;
  index: number;
};

declare global {
  interface Window {
    __homeActiveSection?: HomeActiveSection;
  }
}

const KEY = "home-section:v1";

function safeParse(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getActiveHomeSection(): HomeActiveSection | null {
  if (typeof window === "undefined") return null;
  const v = (window as any).__homeActiveSection as HomeActiveSection | undefined;
  if (!v?.id) return null;
  return v;
}

export function getSavedHomeSection(): SavedHomeSection | null {
  if (typeof window === "undefined") return null;
  const obj = safeParse(window.sessionStorage.getItem(KEY));
  const id = obj?.id;
  const type = obj?.type;
  if (typeof id !== "string" || !id) return null;
  if (typeof type !== "string" || !type) return null;
  return { id, type };
}

export function saveHomeSection(section: SavedHomeSection) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(section));
  } catch {
    // ignore
  }
}

export function saveActiveHomeSectionNow() {
  const active = getActiveHomeSection();
  if (!active?.id) return;
  saveHomeSection({ id: active.id, type: active.type || "" });
}

export function scrollHomeToSectionId(sectionId: string) {
  if (typeof window === "undefined") return;

  const st = (ScrollTrigger.getById("hs-horizontal") as ScrollTrigger) ?? null;
  if (!st) return;

  const el = document.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(sectionId)}"]`);
  if (!el) return;

  const amountToScroll = Math.max(0, (st.end ?? 0) - (st.start ?? 0));
  if (!Number.isFinite(amountToScroll) || amountToScroll <= 0) return;

  const vw = window.innerWidth || 1;
  const targetX = el.offsetLeft + el.offsetWidth / 2 - vw / 2;
  const clampedX = Math.max(0, Math.min(amountToScroll, targetX));

  const y = (st.start ?? 0) + clampedX;
  setCurrentScrollY(y);
}
