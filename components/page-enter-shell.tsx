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

  // IMPORTANT: allow hover *after* home is visible and scroll is unlocked.
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

        if (window.__heroDone) {
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

        if (window.__heroDone) {
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
        const heroTargets = document.querySelectorAll<HTMLElement>(`[data-hero-slug="${heroPending.slug}"]`);
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

      if (window.__heroDone) {
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
