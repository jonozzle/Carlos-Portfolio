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
  onHomeToggle?: () => void;
  homeLabel?: string;
  ariaControls?: string;
  ariaExpanded?: boolean;
  homeFollowRef?: React.RefObject<HTMLElement | null>;
  homeFollow?: boolean;
};

const TOP_THRESHOLD = 0;
const BOOKMARK_TALL_VH = 0.5;
const BASE_RECT_HEIGHT = 24;
const TAIL_HEIGHT = 40;
const BASE_SHAPE_HEIGHT = BASE_RECT_HEIGHT + TAIL_HEIGHT;
const HOME_ANCHOR_HEIGHT = 92;
const DROP_Y = -42;

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
  onHomeToggle,
  homeLabel,
  ariaControls,
  ariaExpanded,
  homeFollowRef,
  homeFollow,
}: BookmarkLinkProps) {
  const { loaderDone } = useLoader();
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";

  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const shownRef = useRef(false);
  const sizeProxyRef = useRef({ height: HOME_ANCHOR_HEIGHT, extra: 0 });
  const sizeTweenRef = useRef<gsap.core.Tween | null>(null);

  const applySize = useCallback((height: number, extra: number) => {
    const el = linkRef.current;
    if (!el) return;
    sizeProxyRef.current.height = height;
    sizeProxyRef.current.extra = extra;
    gsap.set(el, { height });
    el.style.setProperty("--bookmark-total", `${height}px`);
    el.style.setProperty("--bookmark-extra", `${extra}px`);
  }, []);

  const updateSize = useCallback(
    (immediate?: boolean) => {
      if (typeof window === "undefined") return;
      const targetHeight = isHome ? HOME_ANCHOR_HEIGHT : window.innerHeight * BOOKMARK_TALL_VH;
      const targetExtra = Math.max(0, targetHeight - BASE_SHAPE_HEIGHT);

      sizeTweenRef.current?.kill();

      if (immediate) {
        applySize(targetHeight, targetExtra);
        return;
      }

      const proxy = sizeProxyRef.current;
      sizeTweenRef.current = gsap.to(proxy, {
        height: targetHeight,
        extra: targetExtra,
        duration: 0.6,
        ease: "power3.out",
        overwrite: "auto",
        onUpdate: () => applySize(proxy.height, proxy.extra),
      });
    },
    [applySize, isHome]
  );

  useEffect(() => {
    if (!shownRef.current) return;
    updateSize();
  }, [isHome, updateSize]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      if (!shownRef.current) return;
      updateSize(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateSize]);

  const resetHiddenSize = useCallback(() => {
    const el = linkRef.current;
    if (!el) return;
    sizeProxyRef.current.height = 0;
    sizeProxyRef.current.extra = 0;
    gsap.set(el, { height: 0 });
    el.style.setProperty("--bookmark-total", "0px");
    el.style.setProperty("--bookmark-extra", "0px");
  }, []);

  const hide = useCallback(() => {
    const el = linkRef.current;
    if (!el) return;
    shownRef.current = false;

    resetHiddenSize();
    gsap.killTweensOf(el, "autoAlpha,y");
    gsap.set(el, { pointerEvents: "none" });
    gsap.to(el, { autoAlpha: 0, y: DROP_Y, duration: 0.2, ease: "power2.in", overwrite: "auto" });
  }, [resetHiddenSize]);

  const show = useCallback(() => {
    const el = linkRef.current;
    if (!el) return;
    shownRef.current = true;

    updateSize();
    gsap.killTweensOf(el, "autoAlpha,y");
    gsap.set(el, { pointerEvents: "auto" });
    gsap.set(el, { autoAlpha: 1 });
    gsap.fromTo(
      el,
      { y: DROP_Y },
      { y: 0, duration: 0.6, ease: "power3.out", overwrite: "auto" }
    );
  }, [updateSize]);

  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Prevent *any* click action on home. No fade, no scroll lock, nothing.
      if (isHome) {
        e.preventDefault();
        onHomeToggle?.();
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

      const isHeroBackType =
        saved?.type === "project-block" || saved?.type === "page-link-section";

      const shouldHeroBack =
        href === "/" &&
        pathname !== "/" &&
        enteredKind === "hero" &&
        atTop &&
        isHeroBackType &&
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
    [heroImgUrlProp, href, isHome, onHomeToggle, pathname, router, slugProp]
  );

  const followActive = !!(isHome && homeFollow && homeFollowRef?.current);

  useEffect(() => {
    if (!followActive) return;
    let raf = 0;
    const el = linkRef.current;
    if (el) gsap.killTweensOf(el, "top");
    const tick = () => {
      const target = homeFollowRef?.current;
      if (el && target) {
        const rect = target.getBoundingClientRect();
        gsap.set(el, { top: rect.bottom, y: 0 });
      }
      raf = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(raf);
  }, [followActive, homeFollowRef]);

  useEffect(() => {
    if (followActive) return;
    const el = linkRef.current;
    if (!el) return;
    gsap.killTweensOf(el, "top");
    gsap.set(el, { top: 0 });
  }, [followActive]);

  useEffect(() => {
    const el = linkRef.current;
    if (!el) return;

    gsap.set(el, { autoAlpha: 0, y: DROP_Y, pointerEvents: "none", willChange: "transform,opacity" });
    resetHiddenSize();

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
  }, [hide, resetHiddenSize, show, loaderDone]);

  const ariaLabel = isHome ? homeLabel ?? "Project index" : "Back";

  return (
    <a
      ref={linkRef}
      href={href}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-controls={isHome ? ariaControls : undefined}
      aria-expanded={isHome ? ariaExpanded : undefined}
      className={cn(
        "group fixed top-0 z-[10010] origin-top",
        side === "left" ? "left-6" : "right-6",
        "inline-flex items-start justify-center",
        "h-[92px] w-12",
        "opacity-0",
        className
      )}
    >
      <div className="relative h-full w-full pointer-events-none">
        <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center">
          <span
            className="block w-4 bg-red-500 transition-[height] duration-300 ease-out"
            style={{ height: `calc(${BASE_RECT_HEIGHT}px + var(--bookmark-extra, 0px))` }}
          />
          <span
            aria-hidden
            className="block w-4 h-[40px] bg-red-500 [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]"
          />
        </div>
      </div>
    </a>
  );
}
