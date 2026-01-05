// BackToHomeButton
// components/project/back-to-home.tsx
"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { lockAppScroll } from "@/lib/scroll-lock";
import { startHeroTransition, clearHeroPendingHard } from "@/lib/hero-transition";
import { getSavedHomeSection } from "@/lib/home-section";
import { setNavIntent } from "@/lib/nav-intent";
import { lockHover } from "@/lib/hover-lock";
import { fadeOutPageRoot } from "@/lib/transitions/page-fade";
import type { PageTransitionKind } from "@/lib/transitions/state";

type Props = {
    slug: string;
    heroImgUrl: string;
    className?: string;
};

export default function BackToHomeButton({ slug, heroImgUrl, className }: Props) {
    const router = useRouter();
    const pathname = usePathname();

    const onClick = useCallback(
        async (e: React.MouseEvent) => {
            e.preventDefault();

            const saved = getSavedHomeSection();

            setNavIntent({
                kind: "project-to-home",
                homeSectionId: saved?.id ?? null,
            });

            lockAppScroll();
            lockHover();

            const enteredKind =
                ((window as any).__pageTransitionLast as PageTransitionKind | undefined) ?? "simple";

            const hasScrolled = !!(window as any).__routeHasScrolled;

            const shouldHeroBack =
                enteredKind === "hero" &&
                !hasScrolled &&
                saved?.type === "project-block" &&
                !!saved?.id;

            (window as any).__pageTransitionPending = {
                direction: "down",
                fromPath: pathname,
                kind: shouldHeroBack ? "hero" : "simple",
                homeSectionId: saved?.id ?? null,
                homeSectionType: saved?.type ?? null,
            };

            const go = () => router.push("/");

            if (!shouldHeroBack) {
                clearHeroPendingHard();
                await fadeOutPageRoot({ duration: 0.26 });
                go();
                return;
            }

            const sourceEl = document.querySelector<HTMLElement>(
                `[data-hero-target="project"][data-hero-slug="${CSS.escape(slug)}"]`
            );

            if (!sourceEl || !heroImgUrl) {
                clearHeroPendingHard();
                await fadeOutPageRoot({ duration: 0.26 });
                go();
                return;
            }

            startHeroTransition({
                slug,
                sourceEl,
                imgUrl: heroImgUrl,
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
