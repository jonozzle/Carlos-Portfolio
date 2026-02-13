// Hero Transition
"use client";

import { gsap } from "gsap";
import type { PendingHero } from "@/lib/transitions/state";
import { fadeOutPageRoot } from "@/lib/transitions/page-fade";

type StartHeroTransitionArgs = {
  slug: string;
  sourceEl: HTMLElement;
  imgUrl: string;
  onNavigate: () => void;
  fadePage?: boolean;
  fadeDuration?: number;
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

function isOverlayBusy(overlay: HTMLDivElement) {
  // Busy if tweening OR parked (parkThenPage mode)
  return overlay.dataset?.heroTweening === "1" || overlay.dataset?.heroParked === "1";
}

function isDesktopSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const vendor = navigator.vendor || "";
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
  const isApple = /Apple/i.test(vendor);
  const isMobile = /Mobile|iP(ad|hone|od)/i.test(ua);
  return isSafari && isApple && !isMobile;
}

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const vendor = navigator.vendor || "";
  return /Safari/i.test(ua) && /Apple/i.test(vendor) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function visualScale(el: HTMLElement): number {
  try {
    const rect = el.getBoundingClientRect();
    const base = (el as any).offsetWidth || (el as any).clientWidth || rect.width;
    if (!base || !Number.isFinite(base)) return 1;
    const s = rect.width / base;
    return Number.isFinite(s) && s > 0 ? s : 1;
  } catch {
    return 1;
  }
}

function parseBestFromSrcset(srcset: string): string | null {
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
  const u = (url || "").toLowerCase();
  if (!u) return true;
  if (u.startsWith("data:")) return true;
  if (u.includes("w=16") || u.includes("w=24") || u.includes("w=32")) return true;
  if (u.includes("blur") || u.includes("lqip")) return true;
  if (u.includes("q=10") || u.includes("q=15")) return true;
  return false;
}

function pickSourceUrl(sourceEl: HTMLElement, fallbackUrl: string) {
  const imgs = Array.from(sourceEl.querySelectorAll("img")) as HTMLImageElement[];
  const existing = imgs.length ? imgs[imgs.length - 1] : null;

  if (!existing) return fallbackUrl;

  // Prefer the *currently displayed* resource if it's already loaded and non-placeholder.
  const painted = existing.currentSrc || existing.src || "";
  if (
    painted &&
    !looksLikePlaceholder(painted) &&
    existing.complete &&
    (existing.naturalWidth ?? 0) > 0
  ) {
    return painted;
  }

  // Otherwise, try best from srcset (may trigger a new request, so we only do this as fallback).
  const fromSrcset = existing.srcset ? parseBestFromSrcset(existing.srcset) : null;
  const candidate = fromSrcset || painted || fallbackUrl;

  if (!candidate) return fallbackUrl;
  if (looksLikePlaceholder(candidate)) return fallbackUrl;

  return candidate;
}

function findHoverScale(sourceEl: HTMLElement) {
  const scaleEl = sourceEl.querySelector<HTMLElement>("[data-hero-img-scale]");
  if (!scaleEl) return 1;
  return clamp(visualScale(scaleEl), 0.5, 2);
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
  img.style.willChange = "transform,opacity";
  img.style.transform = "translate3d(0,0,0)";
  img.style.backfaceVisibility = "hidden";
  img.style.webkitBackfaceVisibility = "hidden";

  img.decoding = "async";
  (img as any).fetchPriority = "high";
  img.loading = "eager";

  const hoverScale = findHoverScale(sourceEl);
  if (Math.abs(hoverScale - 1) > 0.001) {
    img.style.transform = `translate3d(0,0,0) scale(${hoverScale})`;
    (img as any).__startScale = hoverScale;
  }

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

function bgFromSource(sourceEl: HTMLElement) {
  try {
    const cs = getComputedStyle(sourceEl);
    const bg = cs.backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
  } catch {
    // ignore
  }
  return "transparent";
}

function bestLoadedImgIn(container: HTMLElement | null): HTMLImageElement | null {
  if (!container) return null;
  const imgs = Array.from(container.querySelectorAll("img")) as HTMLImageElement[];
  if (!imgs.length) return null;

  let best: HTMLImageElement | null = null;
  let bestScore = -1;

  for (const img of imgs) {
    const url = img.currentSrc || img.src || "";
    if (looksLikePlaceholder(url)) continue;
    if (!img.complete) continue;

    const w = img.naturalWidth || 0;
    const h = img.naturalHeight || 0;
    if (w <= 0 || h <= 0) continue;

    const score = w * h;
    if (score > bestScore) {
      bestScore = score;
      best = img;
    }
  }

  return best;
}

async function decodeIfPossible(img: HTMLImageElement) {
  try {
    const dec = (img as any).decode?.();
    if (dec && typeof dec.then === "function") await dec;
  } catch {
    // ignore
  }
}

async function waitForBestNonPlaceholderImg(container: HTMLElement | null, timeoutMs = 900) {
  if (typeof window === "undefined") return null;

  const start = performance.now();

  return new Promise<HTMLImageElement | null>((resolve) => {
    let raf = 0;

    const tick = () => {
      const best = bestLoadedImgIn(container);
      if (best) {
        decodeIfPossible(best).finally(() => resolve(best));
        return;
      }

      if (performance.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
  });
}

function fadeOutAndRemoveOverlay(overlay: HTMLDivElement, onRemoved?: () => void) {
  if (typeof document === "undefined") return;

  if (!document.body.contains(overlay)) {
    onRemoved?.();
    return;
  }

  try {
    gsap.killTweensOf(overlay);
  } catch {
    // ignore
  }

  gsap.to(overlay, {
    opacity: 0,
    duration: 0.14,
    ease: "power1.out",
    overwrite: "auto",
    force3D: true,
    onComplete: () => {
      try {
        overlay.remove();
      } catch {
        // ignore
      }
      onRemoved?.();
    },
  });
}

export function startHeroTransition({
  slug,
  sourceEl,
  imgUrl,
  onNavigate,
  fadePage = true,
  fadeDuration,
}: StartHeroTransitionArgs) {
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
  overlay.style.zIndex = "10000";
  overlay.style.pointerEvents = "none";
  overlay.style.willChange = "left, top, width, height, transform, opacity";
  overlay.style.transform = "translate3d(0,0,0)";
  overlay.style.backfaceVisibility = "hidden";
  overlay.style.webkitBackfaceVisibility = "hidden";
  overlay.style.background = bgFromSource(sourceEl);

  const overlayImg = ensureOverlayImage(sourceEl, imgUrl);
  overlay.appendChild(overlayImg);

  document.body.appendChild(overlay);

  // Hide the source after the overlay is inserted (prevents a blank frame).
  requestAnimationFrame(() => {
    try {
      sourceEl.style.transition = "none";
      sourceEl.style.opacity = "0";
      sourceEl.style.visibility = "hidden";
      sourceEl.style.pointerEvents = "none";
    } catch {
      // ignore
    }
  });

  try {
    if ((window as any).__heroPending?.overlay && (window as any).__heroPending.overlay !== overlay) {
      (window as any).__heroPending.overlay.remove();
    }
  } catch {
    // ignore
  }

  const pending: PendingHero = { slug, overlay, overlayImg };
  (window as any).__heroPending = pending;

  const runNavigate = () => {
    requestAnimationFrame(() => {
      onNavigate();
    });
  };

  if (fadePage) {
    void fadeOutPageRoot({ duration: fadeDuration }).finally(runNavigate);
  } else {
    runNavigate();
  }
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

  if (isOverlayBusy(overlay)) return;

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
      willChange: "left,top,width,height,transform,opacity",
      force3D: true,
    });

    // Hide target during flight.
    gsap.set(t, { opacity: 0 });

    try {
      gsap.killTweensOf(overlay);
      if (overlayImg) gsap.killTweensOf(overlayImg);
    } catch {
      // ignore
    }

    markOverlayTweening(overlay, true);

    const D = isSafariBrowser() ? 0.82 : 0.9;
    const tl = gsap.timeline({ defaults: { duration: D, ease: "power3.inOut" } });

    tl.to(
      overlay,
      {
        left: toRect.left,
        top: toRect.top,
        width: toRect.width,
        height: toRect.height,
        force3D: true,
      },
      0
    );

    if (overlayImg) {
      const startScale = (overlayImg as any).__startScale as number | undefined;
      if (typeof startScale === "number" && Math.abs(startScale - 1) > 0.001) {
        tl.to(
          overlayImg,
          {
            scale: 1,
            ease: "power2.out",
            force3D: true,
          },
          0
        );
      }
    }

    if (mode === "parkThenPage") {
      tl.eventCallback("onComplete", () => {
        // Make target visible immediately under the overlay (helps mask tile image crossfades).
        try {
          gsap.set(t, { opacity: 1 });
          t.style.pointerEvents = "none";
        } catch {
          // ignore
        }

        markOverlayTweening(overlay, false);
        try {
          overlay.dataset.heroParked = "1";
        } catch {
          // ignore
        }

        (window as any).__heroPending = { slug, overlay, targetEl: t, overlayImg };
        dispatchHeroDone();
        onDone?.();

        // Safari desktop: if finalize doesn't run, force-remove the overlay.
        if (isDesktopSafari()) {
          window.setTimeout(() => {
            const cur = (window as any).__heroPending as PendingHero | undefined;
            if (cur?.overlay !== overlay) return;
            if (typeof document === "undefined" || !document.body.contains(overlay)) return;

            try {
              gsap.killTweensOf(overlay);
            } catch {
              // ignore
            }
            try {
              overlay.remove();
            } catch {
              // ignore
            }

            try {
              gsap.set(t, { opacity: 1, clearProps: "visibility,pointerEvents" });
            } catch {
              // ignore
            }

            (window as any).__heroPending = undefined;
            (window as any).__heroDone = true;
          }, 2000);
        }
      });

      return;
    }

    tl.eventCallback("onComplete", () => {
      markOverlayTweening(overlay, false);

      gsap.set(t, { opacity: 1 });
      gsap.set(overlay, { willChange: "auto" });

      dispatchHeroDone();
      onDone?.();

      waitForBestNonPlaceholderImg(t, 900).finally(() => {
        if (typeof document !== "undefined" && !document.body.contains(overlay)) {
          (window as any).__heroPending = undefined;
          return;
        }

        fadeOutAndRemoveOverlay(overlay, () => {
          const cur = (window as any).__heroPending as PendingHero | undefined;
          if (cur?.overlay === overlay) (window as any).__heroPending = undefined;
          markOverlayTweening(overlay, false);
        });
      });
    });
  };

  requestAnimationFrame(attempt);
}

/**
 * Hard-kill any existing hero overlay.
 * Use this before any NON-hero navigation to prevent “fade + hero overlay mix”.
 */
export function clearHeroPendingHard() {
  if (typeof window === "undefined") return;

  const pending = (window as any).__heroPending as PendingHero | undefined;
  if (!pending?.overlay) {
    (window as any).__heroPending = undefined;
    return;
  }

  try {
    markOverlayTweening(pending.overlay, false);
    delete pending.overlay.dataset.heroParked;
  } catch {
    // ignore
  }

  try {
    pending.overlay.remove();
  } catch {
    // ignore
  }

  (window as any).__heroPending = undefined;
}
