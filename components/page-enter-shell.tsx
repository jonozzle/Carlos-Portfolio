// PageEnterShell
"use client";

import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import type { PendingHero, PageTransitionPending } from "@/lib/transitions/state";
import { unlockAppScroll } from "@/lib/scroll-lock";
import { unlockHover } from "@/lib/hover-lock";

function resetTransitionLayer() {
  if (typeof document === "undefined") return;
  const layer = document.getElementById("transition-layer") as HTMLDivElement | null;
  if (!layer) return;

  try {
    gsap.killTweensOf(layer);
    gsap.killTweensOf(Array.from(layer.children));
  } catch {
    // ignore
  }

  try {
    layer.innerHTML = "";
  } catch {
    // ignore
  }

  try {
    gsap.set(layer, {
      autoAlpha: 0,
      backgroundColor: "transparent",
      clearProps: "opacity,visibility,filter,transform,background,backgroundColor",
    });
  } catch {
    // ignore
  }
}

function forcePageRootVisible(pageRoot: HTMLElement) {
  try {
    gsap.killTweensOf(pageRoot);
  } catch {
    // ignore
  }

  try {
    gsap.set(pageRoot, {
      opacity: 1,
      visibility: "visible",
      pointerEvents: "auto",
      clearProps: "opacity,visibility,pointerEvents",
    });
  } catch {
    // ignore
  }
}

function clearStaleHeroPending() {
  const current = window.__heroPending as PendingHero | undefined;
  if (!current) return;

  const slug = current.slug;
  const overlay = current.overlay;

  if (slug) {
    const targets = document.querySelectorAll<HTMLElement>(`[data-hero-slug="${slug}"]`);
    targets.forEach((el) => gsap.set(el, { opacity: 1, clearProps: "visibility,pointerEvents" }));
  }

  try {
    delete overlay?.dataset?.heroParked;
    overlay?.remove();
  } catch {
    // ignore
  }

  window.__heroPending = undefined;
  (window as any).__heroDone = true;
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
    void raf;
  });
}

function forceTileVisualsReady(container: HTMLElement | null) {
  if (!container) return;

  try {
    gsap.killTweensOf(container);
    gsap.set(container, { opacity: 1, visibility: "visible", clearProps: "filter" });
  } catch {
    // ignore
  }

  // Kill any “internal crossfade” that might still be mid-transition (SmoothImage, Next, etc.)
  // We only touch inline styles to avoid fighting your CSS.
  const nodes = Array.from(container.querySelectorAll<HTMLElement>("*"));
  for (const n of nodes) {
    try {
      if (n.style && (n.style.opacity === "0" || n.style.opacity === "0.0")) {
        n.style.opacity = "1";
      }
      if (n.tagName === "IMG") {
        const img = n as HTMLImageElement;
        img.style.opacity = "1";
        img.style.visibility = "visible";
        img.style.transition = "none";
        img.style.filter = "none";
      }
    } catch {
      // ignore
    }
  }
}

function finalizeParkedHero() {
  const current = window.__heroPending as PendingHero | undefined;
  const slug = current?.slug;
  const overlay = current?.overlay;
  const targetEl = current?.targetEl ?? null;

  if (slug) {
    const targets = document.querySelectorAll<HTMLElement>(`[data-hero-slug="${slug}"]`);
    // Also clears pointerEvents we temporarily set in parkThenPage completion.
    targets.forEach((el) => gsap.set(el, { opacity: 1, clearProps: "visibility,pointerEvents" }));

    try {
      window.dispatchEvent(new CustomEvent("hero-page-hero-show", { detail: { slug } }));
    } catch {
      // ignore
    }
  }

  if (targetEl) {
    gsap.set(targetEl, { opacity: 1 });
    forceTileVisualsReady(targetEl);
  }

  window.__heroPending = undefined;

  if (overlay) {
    (async () => {
      // Give the tile time to get a real image (non-placeholder) ready.
      await waitForBestNonPlaceholderImg(targetEl, 900);

      // Once we’ve got something real, force it fully visible before fading the overlay.
      forceTileVisualsReady(targetEl);

      if (typeof document === "undefined") return;
      if (!document.body.contains(overlay)) return;

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
        onComplete: () => {
          try {
            overlay.remove();
          } catch {
            // ignore
          }
        },
      });
    })();
  }

  unlockAppScroll();
  requestAnimationFrame(() => unlockHover());
}

type Props = { children: ReactNode };

export default function PageEnterShell({ children }: Props) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    resetTransitionLayer();

    const pageRoot = document.getElementById("page-root");
    if (!pageRoot) return;

    forcePageRootVisible(pageRoot);

    gsap.set(pageRoot, { yPercent: 0 });

    const pending = window.__pageTransitionPending as PageTransitionPending | undefined;
    window.__pageTransitionPending = undefined;

    window.__pageTransitionLast = pending?.kind ?? "simple";

    const skipInitial = window.__pageEnterSkipInitial;
    window.__pageEnterSkipInitial = undefined;

    const heroPending = window.__heroPending as PendingHero | undefined;
    const isHeroNav = pending?.kind === "hero";

    if (heroPending && !isHeroNav) clearStaleHeroPending();

    if (!pending) {
      if (!skipInitial) {
        gsap.fromTo(
          pageRoot,
          { opacity: 0 },
          { opacity: 1, duration: 0.45, ease: "power2.out", clearProps: "opacity" }
        );
      } else {
        gsap.set(pageRoot, { opacity: 1, clearProps: "opacity" });
      }
      return;
    }

    const direction: "up" | "down" = pending.direction === "down" ? "down" : "up";

    if (isHeroNav && (window.__heroPending as PendingHero | undefined)) {
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
                // If we arrived with a parked overlay, make sure we finalize it.
                finalizeParkedHero();
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
              // Project -> Home uses parkThenPage:
              // finalize here so the overlay doesn't get removed before the tile is ready.
              finalizeParkedHero();
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

      const hp = window.__heroPending as PendingHero | undefined;
      if (hp?.slug) {
        const heroTargets = document.querySelectorAll<HTMLElement>(`[data-hero-slug="${hp.slug}"]`);
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
  }, [pathname]);

  return <>{children}</>;
}
