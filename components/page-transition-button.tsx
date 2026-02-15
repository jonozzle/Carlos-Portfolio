// PageTransitionButton
// components/page-transition-button.tsx
"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { startHeroTransition } from "@/lib/hero-transition";
import type { PageDirection, PageTransitionKind } from "@/lib/transitions/state";
import { saveScrollForPath } from "@/lib/scroll-state";
import {
  getActiveHomeSection,
  getSavedHomeSection,
  saveActiveHomeSectionNow,
  saveHomeSection,
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

const TOP_THRESHOLD_DESKTOP = 24;
const TOP_THRESHOLD_MOBILE = 96;

function getTopThreshold() {
  if (typeof window === "undefined") return TOP_THRESHOLD_DESKTOP;
  return window.matchMedia("(max-width: 767px)").matches
    ? TOP_THRESHOLD_MOBILE
    : TOP_THRESHOLD_DESKTOP;
}

function setHomeHold(on: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (on) root.dataset.homeHold = "1";
  else delete (root as any).dataset.homeHold;
}

function getRawScrollY(): number {
  if (typeof window === "undefined") return 0;
  const y =
    (typeof window.scrollY === "number" ? window.scrollY : 0) ||
    (typeof document !== "undefined" && typeof document.documentElement?.scrollTop === "number"
      ? document.documentElement.scrollTop
      : 0) ||
    0;

  return Number.isFinite(y) ? Math.max(0, y) : 0;
}

function clearAnyHeroPending() {
  if (typeof window === "undefined") return;
  const p = (window as any).__heroPending as { overlay?: HTMLElement } | undefined;
  try {
    p?.overlay?.remove();
  } catch {
    // ignore
  }
  (window as any).__heroPending = undefined;
}

function getHeroSourceFromCurrentPage(): { slug: string; sourceEl: HTMLElement; imgUrl: string } | null {
  if (typeof document === "undefined") return null;

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

function getHomeSectionSnapshotFromEl(el: HTMLElement | null): { id: string; type: string } | null {
  const section = el?.closest<HTMLElement>("[data-section-id]");
  if (!section) return null;

  const id = (section.getAttribute("data-section-id") || "").trim();
  const type = (section.getAttribute("data-section-type") || "").trim();
  if (!id) return null;

  return { id, type: type || "unknown" };
}

function isMobileNow() {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(max-width: 767px)").matches;
  } catch {
    return false;
  }
}

function getHeroThemeSettleDelayMs() {
  if (typeof window === "undefined") return 0;
  const readyAt = Number((window as any).__heroThemeLockReadyAt ?? 0);
  if (!Number.isFinite(readyAt) || readyAt <= 0) return 0;
  const now = performance.now();
  return Math.max(0, Math.min(260, Math.round(readyAt - now)));
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

      // CRITICAL: use RAW scroll (native) so ScrollSmoother lag can’t trick us into thinking we’re at top
      const rawYBeforeLock = pathname !== "/" ? getRawScrollY() : 0;

      lockHover();
      lockAppScroll();

      const activeHome = pathname === "/" ? getActiveHomeSection() : null;
      let homeSectionId = activeHome?.id ?? null;
      let homeSectionType = activeHome?.type ?? null;

      if (pathname === "/") {
        saveActiveHomeSectionNow();

        if (!homeSectionId) {
          const heroFallback = getHomeSectionSnapshotFromEl(heroSourceRef?.current ?? null);
          const clickFallback = getHomeSectionSnapshotFromEl(e.currentTarget as HTMLElement);
          const fallback = heroFallback ?? clickFallback;

          if (fallback?.id) {
            saveHomeSection({ id: fallback.id, type: fallback.type });
            homeSectionId = fallback.id;
            homeSectionType = fallback.type;
          }
        }
      } else {
        saveScrollForPath(pathname);
      }

      const isProjectRoute = href.startsWith("/projects/");
      const isGoingHome = href === "/" && pathname !== "/";

      // =========================
      // NON-HOME -> HOME
      // =========================
      if (isGoingHome) {
        const saved = getSavedHomeSection();

        setNavIntent({ kind: "project-to-home", homeSectionId: saved?.id ?? null });

        const enteredKind =
          ((window as any).__pageTransitionLast as PageTransitionKind | undefined) ?? "simple";

        const atTop = rawYBeforeLock <= getTopThreshold();

        const shouldHeroBack =
          enteredKind === "hero" &&
          atTop &&
          !!saved?.id;

        if (shouldHeroBack) {
          (window as any).__deferHomeThemeReset = true;

          const hero = getHeroSourceFromCurrentPage();
          if (hero) {
            setHomeHold(true);
            startHeroTransition({
              slug: hero.slug,
              sourceEl: hero.sourceEl,
              imgUrl: hero.imgUrl,
              onNavigate: () => onNavigate("hero", saved?.id ?? null, saved?.type ?? null),
            });
            return;
          }
        }

        // Fade back: ensure no stale hero overlay can complete on home tiles
        (window as any).__deferHomeThemeReset = false;
        clearAnyHeroPending();

        await fadeOutPageRoot({ duration: 0.26 });
        setHomeHold(true);
        onNavigate("simple", saved?.id ?? null, saved?.type ?? null);
        return;
      }

      // =========================
      // HOME -> OTHER (or other -> other)
      // =========================
      let kind: PageTransitionKind = "simple";

      const slug = heroSlug?.trim();
      const sourceEl = heroSourceRef?.current ?? null;

      if (slug && sourceEl && heroImgUrl) {
        kind = "hero";
        const runHeroNav = () => {
          if (typeof window !== "undefined") {
            (window as any).__heroThemeLockReadyAt = 0;
          }
          startHeroTransition({
            slug,
            sourceEl,
            imgUrl: heroImgUrl,
            onNavigate: () => onNavigate(kind, homeSectionId, homeSectionType),
          });
        };

        const shouldDelayForTheme = pathname === "/" && isMobileNow();
        const settleDelay = shouldDelayForTheme ? getHeroThemeSettleDelayMs() : 0;

        if (settleDelay > 0) {
          window.setTimeout(runHeroNav, settleDelay);
        } else {
          runHeroNav();
        }
        return;
      }

      if (pathname === "/" && homeSectionType === "hero-contents" && isProjectRoute) {
        kind = "fadeHero";
      }

      await fadeOutPageRoot({ duration: 0.26 });
      onNavigate(kind, homeSectionId, homeSectionType);
    },
    [disabled, heroImgUrl, heroSlug, heroSourceRef, href, onNavigate, pathname]
  );

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
