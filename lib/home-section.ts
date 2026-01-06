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
    __hsMode?: "horizontal" | "vertical";
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

function maxScrollY(): number {
  if (typeof window === "undefined") return 0;
  const vh = window.innerHeight || 1;
  const docH = document.documentElement?.scrollHeight || 0;
  return Math.max(0, docH - vh);
}

export function scrollHomeToSectionId(sectionId: string) {
  if (typeof window === "undefined") return;

  const el = document.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(sectionId)}"]`);
  if (!el) return;

  const mode = ((window as any).__hsMode as "horizontal" | "vertical" | undefined) ?? "horizontal";

  // MOBILE (vertical stack)
  if (mode === "vertical") {
    const vh = window.innerHeight || 1;

    // Center the section in the viewport (closest equivalent to your horizontal centering)
    const targetY = el.offsetTop + el.offsetHeight / 2 - vh / 2;
    const y = Math.max(0, Math.min(maxScrollY(), targetY));

    setCurrentScrollY(y);
    return;
  }

  // DESKTOP (pinned horizontal mapping)
  const st = (ScrollTrigger.getById("hs-horizontal") as ScrollTrigger) ?? null;
  if (!st) return;

  const amountToScroll = Math.max(0, (st.end ?? 0) - (st.start ?? 0));
  if (!Number.isFinite(amountToScroll) || amountToScroll <= 0) return;

  const vw = window.innerWidth || 1;
  const targetX = el.offsetLeft + el.offsetWidth / 2 - vw / 2;
  const clampedX = Math.max(0, Math.min(amountToScroll, targetX));

  const y = (st.start ?? 0) + clampedX;
  setCurrentScrollY(y);
}
