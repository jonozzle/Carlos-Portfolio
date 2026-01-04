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

type BookmarkLinkProps = {
  href?: string;
  side?: "left" | "right";
  className?: string;

  /**
   * Optional: if you *can* provide these, it will behave exactly like BackToHomeButton.
   * If you don't provide them (common for header), the component will resolve them from the DOM.
   */
  slug?: string;
  heroImgUrl?: string;
};

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

  // last resort: try a child that might hold bg-image
  const anyBg = sourceEl.querySelector<HTMLElement>("[style*='background-image']");
  if (anyBg) {
    const bg2 = extractBgUrl(getComputedStyle(anyBg).backgroundImage);
    if (bg2) return bg2;
  }

  return null;
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
    gsap.to(el, {
      autoAlpha: 0,
      y: -24,
      duration: 0.2,
      ease: "power2.in",
      overwrite: "auto",
    });
  }, []);

  const show = useCallback(() => {
    const el = linkRef.current;
    if (!el) return;
    shownRef.current = true;

    gsap.killTweensOf(el);
    gsap.set(el, { pointerEvents: "auto" });
    gsap.to(el, {
      autoAlpha: 1,
      y: 0,
      duration: 0.45,
      ease: "power3.out",
      overwrite: "auto",
    });
  }, []);

  // Click logic: SAME DECISION TREE as BackToHomeButton.
  // The only difference: if slug/heroImgUrl aren't provided (header usage),
  // we resolve them from the DOM so hero-back can still run.
  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();

      const saved = getSavedHomeSection();
      const shouldHeroBack = saved?.type === "project-block" && !!saved?.id;

      lockAppScroll();
      lockHover(); // IMPORTANT: prevent hover-scale popping during restore

      setNavIntent({
        kind: "project-to-home",
        homeSectionId: saved?.id ?? null,
      });

      (window as any).__pageTransitionPending = {
        direction: "down",
        fromPath: pathname,
        kind: shouldHeroBack ? "hero" : "simple",
        homeSectionId: saved?.id ?? null,
        homeSectionType: saved?.type ?? null,
      };

      const go = () => router.push(href);

      if (!shouldHeroBack) {
        go();
        return;
      }

      // Try to find the project hero source element (works for header usage).
      const sourceEl =
        (slugProp
          ? document.querySelector<HTMLElement>(
            `[data-hero-target="project"][data-hero-slug="${CSS.escape(slugProp)}"]`
          )
          : null) ??
        document.querySelector<HTMLElement>(`[data-hero-target="project"][data-hero-slug]`) ??
        document.querySelector<HTMLElement>(`[data-hero-target="project"]`);

      const resolvedSlug =
        slugProp ||
        sourceEl?.getAttribute("data-hero-slug") ||
        (sourceEl as any)?.dataset?.heroSlug ||
        "";

      const resolvedImgUrl = heroImgUrlProp || resolveHeroImgUrl(sourceEl);

      if (!sourceEl || !resolvedSlug || !resolvedImgUrl) {
        go();
        return;
      }

      startHeroTransition({
        slug: resolvedSlug,
        sourceEl,
        imgUrl: resolvedImgUrl,
        onNavigate: go,
      });
    },
    [heroImgUrlProp, href, pathname, router, slugProp]
  );

  useEffect(() => {
    const el = linkRef.current;
    if (!el) return;

    // FOUC-safe baseline (server + pre-hydration)
    gsap.set(el, {
      autoAlpha: 0,
      y: -24,
      pointerEvents: "none",
      willChange: "transform,opacity",
    });

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
      {/* Visual bookmark (does NOT move, only extends) */}
      <div className="relative flex h-full w-full items-start justify-center pointer-events-none">
        <div className="flex flex-col items-center">
          {/* Top extension block: only this height animates */}
          <span
            className="
              block w-4 bg-red-500
              h-[24px]
              transition-[height] duration-300 ease-out
              group-hover:h-[50px]
            "
          />
          {/* Main bookmark with inverted triangle cutout at bottom */}
          <span
            aria-hidden
            className="
              block w-4 h-[40px] bg-red-500
              [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]
            "
          />
        </div>
      </div>
    </a>
  );
}
