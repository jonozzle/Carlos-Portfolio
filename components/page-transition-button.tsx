// PageTransitionButton
// components/page-transition-button.tsx
"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { startHeroTransition } from "@/lib/hero-transition";
import type { PageDirection, PageTransitionKind } from "@/lib/transitions/state";
import { getCurrentScrollY, saveScrollForPath } from "@/lib/scroll-state";
import { getActiveHomeSection, getSavedHomeSection, saveActiveHomeSectionNow } from "@/lib/home-section";
import { lockAppScroll } from "@/lib/scroll-lock";
import { fadeOutPageRoot } from "@/lib/transitions/page-fade";
import { setNavIntent } from "@/lib/nav-intent";
import { lockHover } from "@/lib/hover-lock";

type Props = React.PropsWithChildren<{
  href: string;
  direction: PageDirection;
  className?: string;

  heroSlug?: string;
  heroSourceRef?: React.RefObject<HTMLElement | null>;
  heroImgUrl?: string;

  disabled?: boolean;
}>;

const SCROLLED_THRESHOLD = 24;

function getHeroSourceFromCurrentPage(): { slug: string; sourceEl: HTMLElement; imgUrl: string } | null {
  if (typeof document === "undefined") return null;

  // Prefer top hero on project/page routes
  const sourceEl =
    document.querySelector<HTMLElement>(`[data-hero-target="project"][data-hero-slug]`) ||
    document.querySelector<HTMLElement>(`[data-hero-target="page"][data-hero-slug]`) ||
    document.querySelector<HTMLElement>(`[data-hero-slug]`);

  if (!sourceEl) return null;

  const slug = sourceEl.getAttribute("data-hero-slug") || "";
  if (!slug) return null;

  const img = sourceEl.querySelector("img") as HTMLImageElement | null;
  const imgUrl = img?.currentSrc || img?.src || "";
  if (!imgUrl) return null;

  return { slug, sourceEl, imgUrl };
}

export default function PageTransitionButton({
  href,
  direction,
  className,
  children,
  heroSlug,
  heroSourceRef,
  heroImgUrl,
  disabled,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const onNavigate = useCallback(
    (kind: PageTransitionKind, homeSectionId?: string | null, homeSectionType?: string | null) => {
      (window as any).__pageTransitionPending = {
        direction,
        fromPath: pathname,
        kind,
        homeSectionId: homeSectionId ?? null,
        homeSectionType: homeSectionType ?? null,
      };

      router.push(href);
    },
    [direction, href, pathname, router]
  );

  const onClick = useCallback(
    async (e: React.MouseEvent) => {
      if (disabled) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      e.preventDefault();

      // Always lock on any navigation
      lockHover();
      lockAppScroll();

      // Save where we are
      const activeHome = pathname === "/" ? getActiveHomeSection() : null;
      if (pathname === "/") saveActiveHomeSectionNow();
      else saveScrollForPath(pathname);

      const isGoingHome = href === "/" && pathname !== "/";

      // =========================
      // NON-HOME -> HOME
      // =========================
      if (isGoingHome) {
        const saved = getSavedHomeSection();

        // set intent so home restores section
        setNavIntent({ kind: "project-to-home", homeSectionId: saved?.id ?? null });

        // Decide hero-back vs fade-back using your rules:
        // - only hero-back if we ENTERED this page via hero
        // - and we are still at (near) the top
        // - and home target is a project-block section
        const enteredKind =
          ((window as any).__pageTransitionLast as PageTransitionKind | undefined) ?? "simple";

        const yNow = getCurrentScrollY();
        const atTop = typeof yNow === "number" ? yNow <= SCROLLED_THRESHOLD : true;

        const canHeroBack =
          enteredKind === "hero" &&
          atTop &&
          saved?.type === "project-block" &&
          !!saved?.id;

        if (canHeroBack) {
          (window as any).__deferHomeThemeReset = true;

          const hero = getHeroSourceFromCurrentPage();
          if (hero) {
            startHeroTransition({
              slug: hero.slug,
              sourceEl: hero.sourceEl,
              imgUrl: hero.imgUrl,
              onNavigate: () => onNavigate("hero", saved?.id ?? null, saved?.type ?? null),
            });
            return;
          }
        }

        // Fade back (no overlay)
        (window as any).__deferHomeThemeReset = false;

        await fadeOutPageRoot({ duration: 0.26 });
        onNavigate("simple", saved?.id ?? null, saved?.type ?? null);
        return;
      }

      // =========================
      // HOME -> OTHER (or other -> other)
      // =========================
      const isProjectRoute = href.startsWith("/projects/");
      let kind: PageTransitionKind = "simple";

      // If we have a hero flight source, do hero
      const slug = heroSlug?.trim();
      const sourceEl = heroSourceRef?.current ?? null;

      if (slug && sourceEl && heroImgUrl) {
        kind = "hero";
        startHeroTransition({
          slug,
          sourceEl,
          imgUrl: heroImgUrl,
          onNavigate: () => onNavigate(kind, activeHome?.id ?? null, activeHome?.type ?? null),
        });
        return;
      }

      // HOME hero-contents -> project: fadeHero
      if (pathname === "/" && isProjectRoute && activeHome?.type === "hero-contents") {
        kind = "fadeHero";
      }

      await fadeOutPageRoot({ duration: 0.26 });
      onNavigate(kind, activeHome?.id ?? null, activeHome?.type ?? null);
    },
    [disabled, heroImgUrl, heroSlug, heroSourceRef, href, onNavigate, pathname]
  );

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
