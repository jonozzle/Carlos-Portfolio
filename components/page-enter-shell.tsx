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
import { APP_EVENTS } from "@/lib/app-events";

declare global {
  interface Window {
    __fadeOverlayActive?: boolean;
  }
}

function getTransitionLayer(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("transition-layer") as HTMLDivElement | null;
}

function clearFadeOverlay() {
  const layer = getTransitionLayer();
  if (!layer) return;
  gsap.killTweensOf(layer);
  gsap.set(layer, { opacity: 0, clearProps: "background,willChange" });
  (window as any).__fadeOverlayActive = false;
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

  window.__heroPending = undefined;

  if (overlay) {
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

    // If nothing is pending, ensure overlay isn't left on
    if (!pending && !heroPending) {
      clearFadeOverlay();

      if (!skipInitial) {
        gsap.fromTo(
          pageRoot,
          { opacity: 0 },
          { opacity: 1, duration: 0.55, ease: "power2.out", clearProps: "opacity" }
        );
      }
      return;
    }

    const direction: "up" | "down" = pending?.direction === "down" ? "down" : "up";

    // =========================
    // HERO PENDING (UNCHANGED)
    // =========================
    if (heroPending) {
      // hero has its own overlay; fade overlay must be off
      clearFadeOverlay();

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
              duration: 0.55,
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
            duration: 0.9,
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
          duration: 0.55,
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

    // =========================
    // FADE ENTRY (CROSSFADE IN)
    // =========================
    const layer = getTransitionLayer();
    const overlayActive = !!(window as any).__fadeOverlayActive && !!layer;

    // Match fadeOut minimum. Make this a bit longer for nicer entry.
    const D_IN = 0.75;

    const crossFadeIn = () => {
      gsap.killTweensOf(pageRoot);
      gsap.set(pageRoot, { opacity: 0 });

      // Let theme settle for a tick, then crossfade in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (overlayActive && layer) {
            gsap.killTweensOf(layer);

            const tl = gsap.timeline({
              defaults: { ease: "power2.inOut" },
              onComplete: () => {
                clearFadeOverlay();
                unlockAppScroll();
                requestAnimationFrame(() => unlockHover());
              },
            });

            tl.to(pageRoot, { opacity: 1, duration: D_IN, clearProps: "opacity" }, 0);
            tl.to(layer, { opacity: 0, duration: D_IN, clearProps: "background,willChange" }, 0);
            return;
          }

          gsap.to(pageRoot, {
            opacity: 1,
            duration: D_IN,
            ease: "power2.out",
            clearProps: "opacity",
            onComplete: () => {
              unlockAppScroll();
              requestAnimationFrame(() => unlockHover());
            },
          });
        });
      });
    };

    // If entering home and restoration is needed, wait (prevents top flash + preserves fade)
    const isEnteringHome = pathname === "/";
    const hasTargetSection = !!pending?.homeSectionId;
    const isFadeKind = pending?.kind === "simple" || pending?.kind === "fadeHero";
    const shouldWaitForHomeRestore = isEnteringHome && isFadeKind && hasTargetSection;

    if (shouldWaitForHomeRestore) {
      // keep page hidden until restore, overlay remains visible from fadeOutPageRoot
      gsap.set(pageRoot, { opacity: 0 });

      const run = () => crossFadeIn();

      if ((window as any).__homeHsRestored) {
        run();
        return;
      }

      window.addEventListener(APP_EVENTS.HOME_HS_RESTORED, run, { once: true });
      const t = window.setTimeout(run, 1600);

      return () => {
        window.removeEventListener(APP_EVENTS.HOME_HS_RESTORED, run as any);
        window.clearTimeout(t);
      };
    }

    crossFadeIn();
  }, [pathname]);

  return <>{children}</>;
}
