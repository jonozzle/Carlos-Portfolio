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
  // Critical: if the previous page faded out (#page-root opacity:0),
  // we must guarantee the next route makes it visible again.
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

  // Make sure any hidden hero targets are visible again
  if (slug) {
    const targets = document.querySelectorAll<HTMLElement>(`[data-hero-slug="${slug}"]`);
    targets.forEach((el) => gsap.set(el, { opacity: 1, clearProps: "visibility,pointerEvents" }));
  }

  try {
    overlay?.remove();
  } catch {
    // ignore
  }

  window.__heroPending = undefined;
  (window as any).__heroDone = true;
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

    resetTransitionLayer();

    const pageRoot = document.getElementById("page-root");
    if (!pageRoot) return;

    // ALWAYS unhide page root first (prevents “blank but interactive” state)
    forcePageRootVisible(pageRoot);

    gsap.set(pageRoot, { yPercent: 0 });

    const pending = window.__pageTransitionPending as PageTransitionPending | undefined;
    window.__pageTransitionPending = undefined;

    window.__pageTransitionLast = pending?.kind ?? "simple";

    const skipInitial = window.__pageEnterSkipInitial;
    window.__pageEnterSkipInitial = undefined;

    const heroPending = window.__heroPending as PendingHero | undefined;
    const isHeroNav = pending?.kind === "hero";

    // If a hero overlay is hanging around but this nav isn't hero, kill it
    if (heroPending && !isHeroNav) clearStaleHeroPending();

    if (!pending) {
      // Even when skipping initial entry fade (loader), ensure visible
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

    // HERO branch ONLY for real hero navs
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

    // simple / fadeHero: do a normal fade-in
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
