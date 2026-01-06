// PageEnterShell
// components/page-enter-shell.tsx
"use client";

import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import type { PendingHero, PageTransitionPending } from "@/lib/transitions/state";
import { unlockAppScroll } from "@/lib/scroll-lock";
import { unlockHover } from "@/lib/hover-lock";

function isMobileHsMode() {
  try {
    return (window as any).__hsMode === "vertical";
  } catch {
    return false;
  }
}

function fadeOutAndRemoveOverlay(overlay: HTMLDivElement) {
  try {
    gsap.killTweensOf(overlay);
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.22,
      ease: "power2.out",
      overwrite: "auto",
      onComplete: () => {
        try {
          overlay.remove();
        } catch {
          // ignore
        }
      },
    });
  } catch {
    try {
      overlay.remove();
    } catch {
      // ignore
    }
  }
}

/**
 * Mobile-only: prevent the “overlay disappears, then tile image appears” blink.
 * We:
 * - force the destination hero targets + inner images to opacity:1 with transitions disabled briefly
 * - wait 2 frames so the browser can paint the tile
 * - then fade the overlay out
 */
function forceShowHomeTargets(slug: string) {
  const targets = Array.from(document.querySelectorAll<HTMLElement>(`[data-hero-slug="${slug}"]`));
  if (!targets.length) return;

  // collect likely opacity-animated descendants too
  const els: HTMLElement[] = [];
  const push = (e: HTMLElement) => {
    if (!e) return;
    if (els.includes(e)) return;
    els.push(e);
  };

  targets.forEach((t) => {
    push(t);
    t.querySelectorAll<HTMLElement>("img, picture, video, [data-hero-img-scale], [data-hero-target]").forEach(push);
  });

  // kill any in-flight fades that might snap opacity
  try {
    gsap.killTweensOf(els);
  } catch {
    // ignore
  }

  // hard-force visible; disable transitions briefly so we don’t see a second fade-in
  els.forEach((el) => {
    try {
      const prev = (el as any).__prevTransition;
      if (prev === undefined) (el as any).__prevTransition = el.style.transition || "";
      el.style.transition = "none";
      el.style.opacity = "1";
      el.style.visibility = "visible";
      el.style.pointerEvents = ""; // let normal rules apply
    } catch {
      // ignore
    }
  });

  // restore transitions after a short moment (opacity stays at 1)
  window.setTimeout(() => {
    els.forEach((el) => {
      try {
        const prev = (el as any).__prevTransition;
        if (typeof prev === "string") el.style.transition = prev;
        (el as any).__prevTransition = undefined;
      } catch {
        // ignore
      }
    });
  }, 350);
}

function removeOverlayWhenTargetPainted(overlay: HTMLDivElement, slug: string, targetEl: HTMLElement | null) {
  if (!overlay) return;

  // Desktop: keep original behavior (remove immediately)
  if (!isMobileHsMode()) {
    requestAnimationFrame(() => {
      try {
        overlay.remove();
      } catch {
        // ignore
      }
    });
    return;
  }

  // Mobile: wait until the destination image is actually ready, then force-show + crossfade overlay out
  const img = targetEl?.querySelector("img") as HTMLImageElement | null;

  const looksReady = () => !!(img && img.complete && img.naturalWidth > 0);

  const finish = () => {
    // make sure the home tile is visible BEFORE overlay fades
    forceShowHomeTargets(slug);

    // give the browser a chance to paint the now-visible tile before removing overlay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fadeOutAndRemoveOverlay(overlay);
      });
    });
  };

  if (!img) {
    finish();
    return;
  }

  if (looksReady()) {
    finish();
    return;
  }

  let done = false;

  const settle = () => {
    if (done) return;
    done = true;

    try {
      img.removeEventListener("load", settle as any);
      img.removeEventListener("error", settle as any);
    } catch {
      // ignore
    }

    finish();
  };

  // fallback timeout (don’t hang)
  const t = window.setTimeout(settle, 900);

  try {
    img.addEventListener("load", () => {
      window.clearTimeout(t);
      settle();
    }, { once: true });
    img.addEventListener("error", () => {
      window.clearTimeout(t);
      settle();
    }, { once: true });
  } catch {
    // ignore
  }

  // Prefer decode() when available
  try {
    const dec = (img as any).decode;
    if (typeof dec === "function") {
      dec
        .call(img)
        .then(() => {
          window.clearTimeout(t);
          settle();
        })
        .catch(() => {
          window.clearTimeout(t);
          settle();
        });
    }
  } catch {
    // ignore
  }
}

function finalizeParkedHero() {
  const current = window.__heroPending as PendingHero | undefined;
  const slug = current?.slug;
  const overlay = current?.overlay;

  if (slug) {
    const targets = document.querySelectorAll<HTMLElement>(`[data-hero-slug="${slug}"]`);
    targets.forEach((el) => gsap.set(el, { opacity: 1, clearProps: "visibility,pointerEvents" }));

    try {
      window.dispatchEvent(new CustomEvent("hero-page-hero-show", { detail: { slug } }));
    } catch {
      // ignore
    }
  }

  if (current?.targetEl) gsap.set(current.targetEl, { opacity: 1 });

  const targetEl = current?.targetEl ?? null;
  const heroSlug = slug ?? "";

  window.__heroPending = undefined;

  if (overlay && heroSlug) {
    removeOverlayWhenTargetPainted(overlay, heroSlug, targetEl);
  } else if (overlay) {
    requestAnimationFrame(() => {
      try {
        overlay.remove();
      } catch {
        // ignore
      }
    });
  }

  unlockAppScroll();
  requestAnimationFrame(() => unlockHover());
}

type Props = { children: ReactNode };

export default function PageEnterShell({ children }: Props) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const pageRoot = document.getElementById("page-root");
    if (!pageRoot) return;

    gsap.set(pageRoot, { yPercent: 0 });

    const pending = window.__pageTransitionPending as PageTransitionPending | undefined;
    window.__pageTransitionPending = undefined;

    window.__pageTransitionLast = pending?.kind ?? "simple";

    const heroPending = window.__heroPending as PendingHero | undefined;

    const skipInitial = window.__pageEnterSkipInitial;
    window.__pageEnterSkipInitial = undefined;

    if (!pending) {
      if (!skipInitial) {
        gsap.fromTo(
          pageRoot,
          { opacity: 0 },
          { opacity: 1, duration: 0.45, ease: "power2.out", clearProps: "opacity" }
        );
      }
      return;
    }

    const direction: "up" | "down" = pending.direction === "down" ? "down" : "up";

    if (heroPending) {
      const animateEls = gsap.utils.toArray<HTMLElement>("[data-hero-page-animate]");

      const runFallbackUnlock = () => {
        unlockAppScroll();
        requestAnimationFrame(() => unlockHover());
        gsap.set(pageRoot, { opacity: 1, clearProps: "opacity" });
      };

      const clearTimer = (id: number | null) => {
        if (id) window.clearTimeout(id);
      };

      if (!animateEls.length) {
        const timer = window.setTimeout(runFallbackUnlock, 1800);

        const done = () => {
          clearTimer(timer);
          gsap.fromTo(
            pageRoot,
            { opacity: 0 },
            {
              opacity: 1,
              duration: 0.45,
              ease: "power2.out",
              clearProps: "opacity",
              onComplete: () => {
                unlockAppScroll();
                requestAnimationFrame(() => unlockHover());
              },
            }
          );
        };

        if ((window as any).__heroDone) {
          requestAnimationFrame(done);
          return;
        }

        window.addEventListener("hero-transition-done", done, { once: true });
        return () => {
          window.removeEventListener("hero-transition-done", done as any);
          clearTimer(timer);
        };
      }

      if (direction === "up") {
        gsap.set(animateEls, { y: 0, opacity: 0, willChange: "transform,opacity" });

        const timer = window.setTimeout(runFallbackUnlock, 2200);

        const done = () => {
          clearTimer(timer);
          gsap.to(animateEls, {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            clearProps: "transform,opacity,willChange",
            onComplete: () => {
              unlockAppScroll();
              requestAnimationFrame(() => unlockHover());
            },
          });
        };

        if ((window as any).__heroDone) {
          requestAnimationFrame(done);
          return;
        }

        window.addEventListener("hero-transition-done", done, { once: true });
        return () => {
          window.removeEventListener("hero-transition-done", done as any);
          clearTimer(timer);
        };
      }

      // direction === "down"
      gsap.set(animateEls, { opacity: 0 });

      if (heroPending.slug) {
        const heroTargets = document.querySelectorAll<HTMLElement>(
          `[data-hero-slug="${heroPending.slug}"]`
        );
        heroTargets.forEach((el) => gsap.set(el, { opacity: 0 }));
      }

      const timer = window.setTimeout(() => {
        gsap.set(animateEls, { opacity: 1, clearProps: "opacity" });
        finalizeParkedHero();
      }, 2400);

      const done = () => {
        clearTimer(timer);
        gsap.to(animateEls, {
          opacity: 1,
          duration: 0.45,
          ease: "power2.out",
          clearProps: "opacity,willChange",
          onComplete: finalizeParkedHero,
        });
      };

      if ((window as any).__heroDone) {
        requestAnimationFrame(done);
        return;
      }

      window.addEventListener("hero-transition-done", done, { once: true });
      return () => {
        window.removeEventListener("hero-transition-done", done as any);
        clearTimer(timer);
      };
    }

    // simple / fadeHero
    gsap.fromTo(
      pageRoot,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.35,
        ease: "power2.out",
        clearProps: "opacity",
        onComplete: () => {
          unlockAppScroll();
          requestAnimationFrame(() => unlockHover());
        },
      }
    );
  }, [pathname]);

  return <>{children}</>;
}
