// PageTransitionButton
// components/page-transition-button.tsx
"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { startHeroTransition } from "@/lib/hero-transition";
import type { PageDirection, PageTransitionKind } from "@/lib/transitions/state";
import { saveScrollForPath, getCurrentScrollY } from "@/lib/scroll-state";
import {
  getActiveHomeSection,
  getSavedHomeSection,
  saveActiveHomeSectionNow,
} from "@/lib/home-section";
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

function getHeroSourceFromPage(): { slug: string; sourceEl: HTMLElement; imgUrl: string } | null {
  if (typeof document === "undefined") return null;

  const candidates = [
    `[data-hero-target="project"][data-hero-slug]`,
    `[data-hero-target="page"][data-hero-slug]`,
    `[data-hero-slug]`,
  ];

  let sourceEl: HTMLElement | null = null;
  for (const sel of candidates) {
    sourceEl = document.querySelector<HTMLElement>(sel);
    if (sourceEl) break;
  }
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

      // Always lock scroll for any nav event
      lockAppScroll();

      // Save “where we are” (HOME = section-id, others = scrollY)
      const activeHome = pathname === "/" ? getActiveHomeSection() : null;
      if (pathname === "/") saveActiveHomeSectionNow();
      else saveScrollForPath(pathname);

      const isProjectRoute = href.startsWith("/projects/");
      const isGoingHome = href === "/" && pathname !== "/";

      /**
       * SPECIAL: any link going back HOME from a non-home page.
       * - Always restore to saved home section
       * - HERO back only if:
       *   - entered current page via HERO
       *   - still at top
       *   - saved home section type was project-block
       */
      if (isGoingHome) {
        const saved = getSavedHomeSection();
        setNavIntent({ kind: "project-to-home", homeSectionId: saved?.id ?? null });
        lockHover();

        const enteredKind = ((window as any).__pageTransitionLast as PageTransitionKind | undefined) ?? "simple";
        const atTop = (getCurrentScrollY() ?? 0) <= 6;

        const canHeroBack =
          enteredKind === "hero" &&
          atTop &&
          saved?.type === "project-block" &&
          !!saved?.id;

        if (canHeroBack) {
          const hero = getHeroSourceFromPage();
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

        await fadeOutPageRoot({ duration: 0.26 });
        onNavigate("simple", saved?.id ?? null, saved?.type ?? null);
        return;
      }

      // Decide transition kind
      let kind: PageTransitionKind = "simple";

      const slug = heroSlug?.trim();
      const sourceEl = heroSourceRef?.current ?? null;

      // Real hero flight (do NOT do page fade-out; overlay is the transition)
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

      // HOME hero-contents => project: no flying hero, just fade hero on project page
      if (pathname === "/" && isProjectRoute && activeHome?.type === "hero-contents") {
        kind = "fadeHero";
      }

      // For non-hero transitions: fade OUT current page first, then navigate.
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
