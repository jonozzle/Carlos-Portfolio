// components/page-transition-button.tsx
"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { startHeroTransition } from "@/lib/hero-transition";
import type { PageDirection, PageTransitionKind } from "@/lib/transitions/state";
import { saveScrollForPath } from "@/lib/scroll-state";
import { getActiveHomeSection, saveActiveHomeSectionNow } from "@/lib/home-section";
import { lockAppScroll } from "@/lib/scroll-lock";
import { fadeOutPageRoot } from "@/lib/transitions/page-fade";

type Props = React.PropsWithChildren<{
  href: string;
  direction: PageDirection;
  className?: string;

  heroSlug?: string;
  heroSourceRef?: React.RefObject<HTMLElement | null>;
  heroImgUrl?: string;

  disabled?: boolean;
}>;

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

      const slug = heroSlug?.trim();
      const sourceEl = heroSourceRef?.current ?? null;

      const isProjectRoute = href.startsWith("/projects/");

      // Decide transition kind
      let kind: PageTransitionKind = "simple";

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
