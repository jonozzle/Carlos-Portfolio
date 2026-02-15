// BackToHomeButton
// components/project/back-to-home.tsx
"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { lockAppScroll } from "@/lib/scroll-lock";
import { startHeroTransition } from "@/lib/hero-transition";
import { getSavedHomeSection } from "@/lib/home-section";
import { setNavIntent } from "@/lib/nav-intent";
import { lockHover } from "@/lib/hover-lock";
import type { PageTransitionKind } from "@/lib/transitions/state";
import { fadeOutPageRoot } from "@/lib/transitions/page-fade";

type Props = {
    slug: string;
    heroImgUrl: string;
    className?: string;
};

const TOP_THRESHOLD_DESKTOP = 24;
const TOP_THRESHOLD_MOBILE = 96;

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

function getTopThreshold() {
    if (typeof window === "undefined") return TOP_THRESHOLD_DESKTOP;
    return window.matchMedia("(max-width: 767px)").matches
        ? TOP_THRESHOLD_MOBILE
        : TOP_THRESHOLD_DESKTOP;
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

export default function BackToHomeButton({ slug, heroImgUrl, className }: Props) {
    const router = useRouter();
    const pathname = usePathname();

    const onClick = useCallback(
        async (e: React.MouseEvent) => {
            e.preventDefault();

            const rawYBeforeLock = getRawScrollY();
            const atTop = rawYBeforeLock <= getTopThreshold();

            const saved = getSavedHomeSection();
            const enteredKind =
                ((window as any).__pageTransitionLast as PageTransitionKind | undefined) ?? "simple";

            const shouldHeroBack =
                enteredKind === "hero" &&
                atTop &&
                !!saved?.id;

            lockAppScroll();
            lockHover();

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

            const go = () => router.push("/");

            if (!shouldHeroBack) {
                (window as any).__deferHomeThemeReset = false;
                clearAnyHeroPending();

                await fadeOutPageRoot({ duration: 0.26 });
                setHomeHold(true);
                go();
                return;
            }

            (window as any).__deferHomeThemeReset = true;

            const hero = getHeroSourceFromCurrentPage();
            const sourceEl =
                hero?.sourceEl ??
                document.querySelector<HTMLElement>(
                    `[data-hero-target="project"][data-hero-slug="${CSS.escape(slug)}"]`
                );

            const imgUrl = hero?.imgUrl || heroImgUrl;

            if (!sourceEl || !imgUrl) {
                (window as any).__deferHomeThemeReset = false;
                clearAnyHeroPending();

                await fadeOutPageRoot({ duration: 0.26 });
                setHomeHold(true);
                go();
                return;
            }

            setHomeHold(true);

            startHeroTransition({
                slug: hero?.slug ?? slug,
                sourceEl,
                imgUrl,
                onNavigate: go,
            });
        },
        [heroImgUrl, pathname, router, slug]
    );

    return (
        <a href="/" onClick={onClick} className={className}>
            Back
        </a>
    );
}
