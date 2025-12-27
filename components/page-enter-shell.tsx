// components/page-enter-shell.tsx
"use client";

import type { ReactNode } from "react";
import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import type { PendingHero } from "@/lib/transitions/state";

function finalizeParkedHero() {
  const current = (window as any).__heroPending as PendingHero | undefined;
  const slug = current?.slug;

  if (slug) {
    const targets = document.querySelectorAll<HTMLElement>(
      `[data-hero-slug="${slug}"]`
    );
    targets.forEach((el) => gsap.set(el, { opacity: 1 }));

    try {
      window.dispatchEvent(
        new CustomEvent("hero-page-hero-show", { detail: { slug } })
      );
    } catch {
      // ignore
    }
  }

  if (current?.targetEl) gsap.set(current.targetEl, { opacity: 1 });

  if (current?.overlay) {
    try {
      current.overlay.remove();
    } catch {
      // ignore
    }
  }

  (window as any).__heroPending = undefined;
}

type Props = { children: ReactNode };

export default function PageEnterShell({ children }: Props) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const pageRoot = document.getElementById("page-root");
    if (!pageRoot) return;

    gsap.set(pageRoot, { yPercent: 0 });

    const pending = (window as any).__pageTransitionPending as
      | { direction?: "up" | "down" }
      | undefined;

    (window as any).__pageTransitionPending = undefined;

    const heroPending = (window as any).__heroPending as PendingHero | undefined;

    const skipInitial = (window as any).__pageEnterSkipInitial;
    (window as any).__pageEnterSkipInitial = undefined;

    // no pending: just fade in (unless loader handles it)
    if (!pending) {
      if (!skipInitial) {
        gsap.fromTo(
          pageRoot,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.45,
            ease: "power2.out",
            clearProps: "opacity",
          }
        );
      }
      return;
    }

    const direction: "up" | "down" = pending.direction === "down" ? "down" : "up";

    // if hero pending, coordinate content fade around it
    if (heroPending) {
      const animateEls = gsap.utils.toArray<HTMLElement>(
        "[data-hero-page-animate]"
      );

      if (!animateEls.length) {
        gsap.fromTo(
          pageRoot,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.45,
            ease: "power2.out",
            clearProps: "opacity",
          }
        );
        return;
      }

      if (direction === "up") {
        // HOME → PROJECT: wait for hero to finish, then bring in content
        gsap.set(animateEls, {
          y: 40,
          opacity: 0,
          willChange: "transform,opacity",
        });

        const onHeroDone = () => {
          gsap.to(animateEls, {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            clearProps: "transform,opacity,willChange",
          });
        };

        window.addEventListener("hero-transition-done", onHeroDone, {
          once: true,
        });

        return;
      }

      // PROJECT → HOME: keep home content hidden until overlay is parked
      gsap.set(animateEls, { opacity: 0 });

      // also hide the hero tile target(s) until we finalize
      if (heroPending.slug) {
        const heroTargets = document.querySelectorAll<HTMLElement>(
          `[data-hero-slug="${heroPending.slug}"]`
        );
        heroTargets.forEach((el) => gsap.set(el, { opacity: 0 }));
      }

      const onHeroDone = () => {
        gsap.to(animateEls, {
          opacity: 1,
          duration: 0.45,
          ease: "power2.out",
          clearProps: "opacity,willChange",
          onComplete: finalizeParkedHero,
        });
      };

      window.addEventListener("hero-transition-done", onHeroDone, {
        once: true,
      });

      return;
    }

    // non-hero entry
    gsap.fromTo(
      pageRoot,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.35,
        ease: "power2.out",
        clearProps: "opacity",
      }
    );
  }, [pathname]);

  return <>{children}</>;
}
