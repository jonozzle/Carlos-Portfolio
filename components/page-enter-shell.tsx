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

    // =========================
    // HERO PENDING (unchanged)
    // =========================
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

    // =========================
    // FADE BACK TO HOME: HOLD UNTIL HS RESTORE
    // =========================
    const isEnteringHome = pathname === "/";
    const hasTargetSection = !!pending.homeSectionId;
    const isFadeKind = pending.kind === "simple" || pending.kind === "fadeHero";

    // Only hold when we expect ScrollManager to restore home position
    // (prevents the “flash top then jump to section”)
    const shouldHoldForHomeRestore = isEnteringHome && isFadeKind && hasTargetSection;

    if (shouldHoldForHomeRestore) {
      gsap.killTweensOf(pageRoot);
      gsap.set(pageRoot, { opacity: 0 });

      let doneRan = false;

      const done = () => {
        if (doneRan) return;
        doneRan = true;

        gsap.killTweensOf(pageRoot);
        gsap.to(pageRoot, {
          opacity: 1,
          duration: 0.35,
          ease: "power2.out",
          clearProps: "opacity",
          onComplete: () => {
            unlockAppScroll();
            requestAnimationFrame(() => unlockHover());
          },
        });
      };

      // If restore already happened, fade in next frame
      if ((window as any).__homeHsRestored) {
        requestAnimationFrame(done);
        return;
      }

      // Otherwise wait for ScrollManager restore event
      window.addEventListener(APP_EVENTS.HOME_HS_RESTORED, done, { once: true });

      // Safety fallback (don’t get stuck hidden)
      const t = window.setTimeout(done, 1400);

      return () => {
        window.removeEventListener(APP_EVENTS.HOME_HS_RESTORED, done as any);
        window.clearTimeout(t);
      };
    }

    // =========================
    // NORMAL SIMPLE / FADEHERO ENTRY
    // =========================
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
