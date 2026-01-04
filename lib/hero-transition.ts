// hero-transition
// lib/hero-transition.ts
"use client";

import { gsap } from "gsap";
import type { PendingHero } from "@/lib/transitions/state";

type StartHeroTransitionArgs = {
  slug: string;
  sourceEl: HTMLElement;
  imgUrl: string;
  onNavigate: () => void;
};

type CompleteHeroTransitionArgs = {
  slug: string;
  targetEl: HTMLElement | null;
  onDone?: () => void;
  mode?: "simple" | "parkThenPage";
};

function dispatchHeroDone() {
  (window as any).__heroDone = true;
  try {
    window.dispatchEvent(new CustomEvent("hero-transition-done"));
  } catch {
    // ignore
  }
}

function markOverlayTweening(overlay: HTMLDivElement, tweening: boolean) {
  try {
    if (tweening) overlay.dataset.heroTweening = "1";
    else delete overlay.dataset.heroTweening;
  } catch {
    // ignore
  }
}

function isOverlayTweening(overlay: HTMLDivElement) {
  return overlay.dataset?.heroTweening === "1";
}

function rectLooksValid(r: DOMRect) {
  return (
    Number.isFinite(r.left) &&
    Number.isFinite(r.top) &&
    Number.isFinite(r.width) &&
    Number.isFinite(r.height) &&
    r.width > 2 &&
    r.height > 2
  );
}

function parseBestFromSrcset(srcset: string): string | null {
  // "url 640w, url2 750w, url3 1080w"
  const parts = srcset
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let bestUrl: string | null = null;
  let bestW = -1;

  for (const p of parts) {
    const segs = p.split(/\s+/);
    const url = segs[0];
    const last = segs[segs.length - 1] || "";
    const m = last.match(/^(\d+)w$/);

    const w = m ? parseInt(m[1], 10) : -1;
    if (w > bestW) {
      bestW = w;
      bestUrl = url || bestUrl;
    }
  }

  return bestUrl;
}

function looksLikePlaceholder(url: string) {
  const u = url.toLowerCase();

  if (u.startsWith("data:")) return true;

  // common low-res/placeholder patterns (sanity/next/smooth-image variants)
  if (u.includes("w=16") || u.includes("w=24") || u.includes("w=32")) return true;
  if (u.includes("blur") || u.includes("lqip")) return true;
  if (u.includes("q=10") || u.includes("q=15")) return true;

  return false;
}

function pickSourceUrl(sourceEl: HTMLElement, fallbackUrl: string) {
  const imgs = Array.from(sourceEl.querySelectorAll("img")) as HTMLImageElement[];
  const existing = imgs.length ? imgs[imgs.length - 1] : null;

  if (!existing) return fallbackUrl;

  const fromSrcset =
    (existing.srcset && parseBestFromSrcset(existing.srcset)) || null;

  const candidate = fromSrcset || existing.currentSrc || existing.src || fallbackUrl;

  if (!candidate) return fallbackUrl;
  if (looksLikePlaceholder(candidate)) return fallbackUrl;

  return candidate;
}

function ensureOverlayImage(sourceEl: HTMLElement, fallbackUrl: string) {
  const url = pickSourceUrl(sourceEl, fallbackUrl);

  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";
  img.style.display = "block";
  img.style.transformOrigin = "50% 50%";
  img.style.filter = "none";

  // Encourage fast decode/fetch for the portal image
  img.decoding = "async";
  (img as any).fetchPriority = "high";
  img.loading = "eager";

  return img;
}

function pickBestHeroTarget(slug: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-hero-slug="${slug}"]`));
  if (!nodes.length) return null;

  let best: HTMLElement | null = null;
  let bestArea = -1;

  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (!rectLooksValid(r)) continue;
    const area = r.width * r.height;
    if (area > bestArea) {
      bestArea = area;
      best = el;
    }
  }

  return best;
}

export function startHeroTransition({ slug, sourceEl, imgUrl, onNavigate }: StartHeroTransitionArgs) {
  if (typeof window === "undefined") {
    onNavigate();
    return;
  }

  (window as any).__heroDone = false;

  const fromRect = sourceEl.getBoundingClientRect();

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.left = `${fromRect.left}px`;
  overlay.style.top = `${fromRect.top}px`;
  overlay.style.width = `${fromRect.width}px`;
  overlay.style.height = `${fromRect.height}px`;
  overlay.style.overflow = "hidden";
  overlay.style.zIndex = "9999";
  overlay.style.pointerEvents = "none";
  overlay.style.willChange = "left, top, width, height, transform, opacity";
  overlay.style.transform = "translateZ(0)";

  const overlayImg = ensureOverlayImage(sourceEl, imgUrl);
  overlay.appendChild(overlayImg);

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    sourceEl.style.transition = "none";
    sourceEl.style.opacity = "0";
    sourceEl.style.visibility = "hidden";
    sourceEl.style.pointerEvents = "none";
  });

  requestAnimationFrame(() => {
    try {
      if ((window as any).__heroPending?.overlay && (window as any).__heroPending.overlay !== overlay) {
        (window as any).__heroPending.overlay.remove();
      }
    } catch {
      // ignore
    }

    const pending: PendingHero = { slug, overlay, overlayImg };
    (window as any).__heroPending = pending;

    onNavigate();
  });
}

export function completeHeroTransition({
  slug,
  targetEl,
  onDone,
  mode = "simple",
}: CompleteHeroTransitionArgs) {
  if (typeof window === "undefined") {
    onDone?.();
    return;
  }

  const pending = (window as any).__heroPending as PendingHero | undefined;

  const cleanupHard = () => {
    try {
      pending?.overlay?.remove();
    } catch {
      // ignore
    }
    (window as any).__heroPending = undefined;
    dispatchHeroDone();
    onDone?.();
  };

  if (!pending) {
    if (targetEl) gsap.set(targetEl, { opacity: 1 });
    onDone?.();
    return;
  }

  if (pending.slug !== slug) {
    if (targetEl) gsap.set(targetEl, { opacity: 1 });
    onDone?.();
    return;
  }

  const overlay = pending.overlay;
  const overlayImg = pending.overlayImg ?? null;

  if (isOverlayTweening(overlay)) return;

  let tries = 0;
  const maxTries = 180;

  const resolveTarget = (): HTMLElement | null => {
    if (targetEl) return targetEl;
    return pickBestHeroTarget(slug);
  };

  const attempt = () => {
    tries += 1;

    const t = resolveTarget();
    if (!t) {
      if (tries < maxTries) {
        requestAnimationFrame(attempt);
        return;
      }
      cleanupHard();
      return;
    }

    const toRect = t.getBoundingClientRect();
    if (!rectLooksValid(toRect)) {
      if (tries < maxTries) {
        requestAnimationFrame(attempt);
        return;
      }
      cleanupHard();
      return;
    }

    const fromRect = overlay.getBoundingClientRect();
    if (!rectLooksValid(fromRect)) {
      cleanupHard();
      return;
    }

    gsap.set(overlay, {
      position: "fixed",
      left: fromRect.left,
      top: fromRect.top,
      width: fromRect.width,
      height: fromRect.height,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
    });

    gsap.set(t, { opacity: 0 });

    gsap.killTweensOf(overlay);
    if (overlayImg) gsap.killTweensOf(overlayImg);

    markOverlayTweening(overlay, true);

    const D = 0.9;
    const tl = gsap.timeline({ defaults: { duration: D, ease: "power3.inOut" } });

    tl.to(
      overlay,
      {
        left: toRect.left,
        top: toRect.top,
        width: toRect.width,
        height: toRect.height,
      },
      0
    );

    if (mode === "parkThenPage") {
      (window as any).__heroPending = { slug, overlay, targetEl: t, overlayImg };

      tl.eventCallback("onComplete", () => {
        markOverlayTweening(overlay, false);
        dispatchHeroDone();
        onDone?.();
      });

      return;
    }

    tl.eventCallback("onComplete", () => {
      markOverlayTweening(overlay, false);

      gsap.set(t, { opacity: 1 });

      try {
        overlay.remove();
      } catch {
        // ignore
      }

      (window as any).__heroPending = undefined;
      dispatchHeroDone();
      onDone?.();
    });
  };

  requestAnimationFrame(attempt);
}
