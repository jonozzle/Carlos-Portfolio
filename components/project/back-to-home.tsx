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

type Props = {
    slug: string;
    heroImgUrl: string;
    className?: string;
};

export default function BackToHomeButton({ slug, heroImgUrl, className }: Props) {
    const router = useRouter();
    const pathname = usePathname();

    const onClick = useCallback(
        (e: React.MouseEvent) => {
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

            const go = () => router.push("/");

            if (!shouldHeroBack) {
                go();
                return;
            }

            const sourceEl = document.querySelector<HTMLElement>(
                `[data-hero-target="project"][data-hero-slug="${CSS.escape(slug)}"]`
            );

            if (!sourceEl || !heroImgUrl) {
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
