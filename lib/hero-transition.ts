// lib/hero-transition.ts
"use client";

import { gsap } from "gsap";

type PendingHero = {
  slug: string;
  overlay: HTMLDivElement;
  targetEl?: HTMLElement | null;
};

declare global {
  interface Window {
    __heroPending?: PendingHero;
  }
}

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
  if (typeof window === "undefined") return;
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

export function startHeroTransition({
  slug,
  sourceEl,
  imgUrl,
  onNavigate,
}: StartHeroTransitionArgs) {
  if (typeof window === "undefined") {
    onNavigate();
    return;
  }

  const fromRect = sourceEl.getBoundingClientRect();

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.left = `${fromRect.left}px`;
  overlay.style.top = `${fromRect.top}px`;
  overlay.style.width = `${fromRect.width}px`;
  overlay.style.height = `${fromRect.height}px`;
  overlay.style.overflow = "hidden";
  overlay.style.zIndex = "1000";
  overlay.style.pointerEvents = "none";
  overlay.style.willChange = "left, top, width, height";

  const imgs = Array.from(sourceEl.querySelectorAll("img"));
  const existingImg =
    imgs.length > 0 ? (imgs[imgs.length - 1] as HTMLImageElement) : null;

  const hiResSrc =
    (existingImg && (existingImg.currentSrc || existingImg.src)) || imgUrl;

  const img = document.createElement("img");
  img.src = hiResSrc;
  img.alt = "";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "cover";

  overlay.appendChild(img);

  // Prefer your fixed transition layer if present (keeps it out of smoother transforms)
  const layer = document.getElementById("transition-layer");
  (layer ?? document.body).appendChild(overlay);

  requestAnimationFrame(() => {
    sourceEl.style.transition = "none";
    sourceEl.style.opacity = "0";
    sourceEl.style.visibility = "hidden";
    sourceEl.style.pointerEvents = "none";
  });

  requestAnimationFrame(() => {
    try {
      if (
        window.__heroPending?.overlay &&
        window.__heroPending.overlay !== overlay
      ) {
        window.__heroPending.overlay.remove();
      }
    } catch {
      // ignore
    }

    window.__heroPending = { slug, overlay };
    onNavigate();
  });
}

export function completeHeroTransition({
  slug,
  targetEl,
  onDone,
  mode = "simple",
}: CompleteHeroTransitionArgs) {
  if (typeof window === "undefined" || !targetEl) {
    onDone?.();
    return;
  }

  const pending = window.__heroPending;

  const finishInstant = () => {
    gsap.set(targetEl, { opacity: 1 });

    if (pending?.overlay) {
      try {
        pending.overlay.remove();
      } catch {
        // ignore
      }
    }

    window.__heroPending = undefined;
    dispatchHeroDone();
    onDone?.();
  };

  if (!pending || pending.slug !== slug) {
    finishInstant();
    return;
  }

  const { overlay } = pending;

  // CRITICAL: if another call tries to animate the same overlay, ignore it.
  if (isOverlayTweening(overlay)) {
    return;
  }

  const runAnimation = () => {
    // If anything tried to tween it before this frame, bail.
    if (isOverlayTweening(overlay)) return;

    const toRect = targetEl.getBoundingClientRect();
    const fromRect = overlay.getBoundingClientRect();

    const rectInvalid =
      !toRect.width ||
      !toRect.height ||
      Number.isNaN(toRect.left) ||
      Number.isNaN(toRect.top);

    if (rectInvalid) {
      finishInstant();
      return;
    }

    // Ensure overlay uses latest fromRect in viewport coords
    gsap.set(overlay, {
      position: "fixed",
      left: fromRect.left,
      top: fromRect.top,
      width: fromRect.width,
      height: fromRect.height,
      opacity: 1,
    });

    // Hide the real target while overlay animates
    gsap.set(targetEl, { opacity: 0 });

    // Make absolutely sure no other tween is affecting this overlay
    gsap.killTweensOf(overlay);

    const MOVE_DURATION = 0.9;

    markOverlayTweening(overlay, true);

    if (mode === "parkThenPage") {
      window.__heroPending = { slug, overlay, targetEl };

      gsap.to(overlay, {
        duration: MOVE_DURATION,
        ease: "power3.inOut",
        left: toRect.left,
        top: toRect.top,
        width: toRect.width,
        height: toRect.height,
        onComplete: () => {
          markOverlayTweening(overlay, false);
          dispatchHeroDone();
          onDone?.();
        },
      });

      return;
    }

    gsap.to(overlay, {
      duration: MOVE_DURATION,
      ease: "power3.inOut",
      left: toRect.left,
      top: toRect.top,
      width: toRect.width,
      height: toRect.height,
      onComplete: () => {
        markOverlayTweening(overlay, false);

        gsap.set(targetEl, { opacity: 1 });

        try {
          overlay.remove();
        } catch {
          // ignore
        }

        window.__heroPending = undefined;
        dispatchHeroDone();
        onDone?.();
      },
    });
  };

  requestAnimationFrame(runAnimation);
}
