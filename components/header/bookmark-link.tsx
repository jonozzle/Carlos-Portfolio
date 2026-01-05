// BookmarkLink
// components/header/bookmark-link.tsx
"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { useLoader } from "@/components/loader/loader-context";
import { APP_EVENTS } from "@/lib/app-events";

import { usePathname, useRouter } from "next/navigation";
import { lockAppScroll } from "@/lib/scroll-lock";
import { startHeroTransition } from "@/lib/hero-transition";
import { getSavedHomeSection } from "@/lib/home-section";
import { setNavIntent } from "@/lib/nav-intent";
import { lockHover } from "@/lib/hover-lock";
import { fadeOutPageRoot } from "@/lib/transitions/page-fade";
import type { PageTransitionKind } from "@/lib/transitions/state";

type BookmarkLinkProps = {
  href?: string;
  side?: "left" | "right";
  className?: string;
  slug?: string;
  heroImgUrl?: string;
};

const TOP_THRESHOLD = 24;

function setHomeHold(on: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (on) root.dataset.homeHold = "1";
  else delete (root as any).dataset.homeHold;
}

function extractBgUrl(bg: string | null | undefined) {
  if (!bg || bg === "none") return null;
  const m = bg.match(/url\((['"]?)(.*?)\1\)/i);
  return m?.[2] ?? null;
}

function resolveHeroImgUrl(sourceEl: HTMLElement | null): string | null {
  if (!sourceEl) return null;

  const img = sourceEl.querySelector("img") as HTMLImageElement | null;
  if (img) return img.currentSrc || img.src || null;

  const bg = extractBgUrl(getComputedStyle(sourceEl).backgroundImage);
  if (bg) return bg;

  const anyBg = sourceEl.querySelector<HTMLElement>("[style*='background-image']");
  if (anyBg) {
    const bg2 = extractBgUrl(getComputedStyle(anyBg).backgroundImage);
    if (bg2) return bg2;
  }

  return null;
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
  (window as any).__heroDone = true;
}

export default function BookmarkLink({
  href = "/",
  side = "left",
  className,
  slug: slugProp,
  heroImgUrl: heroImgUrlProp,
}: BookmarkLinkProps) {
  const { loaderDone } = useLoader();
  const router = useRouter();
  const pathname = usePathname();

  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const shownRef = useRef(false);

  const hide = useCallback(() => {
    const el = linkRef.current;
    if (!el) return;
    shownRef.current = false;

    gsap.killTweensOf(el);
    gsap.set(el, { pointerEvents: "none" });
    gsap.to(el, { autoAlpha: 0, y: -24, duration: 0.2, ease: "power2.in", overwrite: "auto" });
  }, []);

  const show = useCallback(() => {
    const el = linkRef.current;
    if (!el) return;
    shownRef.current = true;

    gsap.killTweensOf(el);
    gsap.set(el, { pointerEvents: "auto" });
    gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out", overwrite: "auto" });
  }, []);

  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Prevent *any* click action on home. No fade, no scroll lock, nothing.
      if (pathname === "/") {
        e.preventDefault();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      e.preventDefault();

      const rawY = getRawScrollY();
      const atTop = rawY <= TOP_THRESHOLD;

      const saved = getSavedHomeSection();
      const enteredKind =
        ((window as any).__pageTransitionLast as PageTransitionKind | undefined) ?? "simple";

      const shouldHeroBack =
        href === "/" &&
        pathname !== "/" &&
        enteredKind === "hero" &&
        atTop &&
        saved?.type === "project-block" &&
        !!saved?.id;

      lockAppScroll();
      lockHover();

      setNavIntent({ kind: "project-to-home", homeSectionId: saved?.id ?? null });

      const pushHome = (kind: PageTransitionKind) => {
        (window as any).__pageTransitionPending = {
          direction: "down",
          fromPath: pathname,
          kind,
          homeSectionId: saved?.id ?? null,
          homeSectionType: saved?.type ?? null,
        };
        router.push(href);
      };

      if (!shouldHeroBack) {
        (window as any).__deferHomeThemeReset = false;
        clearAnyHeroPending();

        await fadeOutPageRoot({ duration: 0.8 });

        // Set hold AFTER fade so it can't kill fade-out, but still prevents home-top flash.
        setHomeHold(true);

        pushHome("simple");
        return;
      }

      // Hero-back
      setHomeHold(false);
      (window as any).__deferHomeThemeReset = true;

      const sourceEl =
        (slugProp
          ? document.querySelector<HTMLElement>(
            `[data-hero-target="project"][data-hero-slug="${CSS.escape(slugProp)}"]`
          )
          : null) ??
        document.querySelector<HTMLElement>(`[data-hero-target="project"][data-hero-slug]`) ??
        document.querySelector<HTMLElement>(`[data-hero-target="project"]`);

      const resolvedSlug =
        slugProp || sourceEl?.getAttribute("data-hero-slug") || (sourceEl as any)?.dataset?.heroSlug || "";

      const resolvedImgUrl = heroImgUrlProp || resolveHeroImgUrl(sourceEl);

      if (!sourceEl || !resolvedSlug || !resolvedImgUrl) {
        (window as any).__deferHomeThemeReset = false;
        clearAnyHeroPending();

        await fadeOutPageRoot({ duration: 0.8 });
        setHomeHold(true);
        pushHome("simple");
        return;
      }

      startHeroTransition({
        slug: resolvedSlug,
        sourceEl,
        imgUrl: resolvedImgUrl,
        onNavigate: () => pushHome("hero"),
      });
    },
    [heroImgUrlProp, href, pathname, router, slugProp]
  );

  useEffect(() => {
    const el = linkRef.current;
    if (!el) return;

    gsap.set(el, { autoAlpha: 0, y: -24, pointerEvents: "none", willChange: "transform,opacity" });

    const onShow = () => show();
    const onHide = () => hide();

    window.addEventListener(APP_EVENTS.UI_BOOKMARK_SHOW, onShow);
    window.addEventListener(APP_EVENTS.UI_BOOKMARK_HIDE, onHide);

    if (loaderDone) show();
    else hide();

    return () => {
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_SHOW, onShow);
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_HIDE, onHide);
    };
  }, [hide, show, loaderDone]);

  useEffect(() => {
    if (!linkRef.current) return;
    if (loaderDone) show();
    else hide();
  }, [loaderDone, show, hide]);

  return (
    <a
      ref={linkRef}
      href={href}
      onClick={onClick}
      aria-label="Back"
      className={cn(
        "group fixed top-0 z-50",
        side === "left" ? "left-6" : "right-6",
        "inline-flex items-start justify-center",
        "h-[92px] w-12",
        "opacity-0",
        className
      )}
    >
      <div className="relative flex h-full w-full items-start justify-center pointer-events-none">
        <div className="flex flex-col items-center">
          <span className="block w-4 bg-red-500 h-[24px] transition-[height] duration-300 ease-out group-hover:h-[50px]" />
          <span
            aria-hidden
            className="block w-4 h-[40px] bg-red-500 [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]"
          />
        </div>
      </div>
    </a>
  );
}
