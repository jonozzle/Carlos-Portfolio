// components/project/back-to-home.tsx
"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { startHeroTransition, completeHeroTransition } from "@/lib/hero-transition";
import { getScrollForPath, saveScrollForPath } from "@/lib/scroll-state";
import { getCurrentScrollY } from "@/lib/scroll-state";

declare global {
    interface Window {
        __restoreNextScroll?: { path: string; y: number };
    }
}

type Props = {
    slug: string;
    heroImgUrl: string;
};

export default function BackToHomeButton({ slug, heroImgUrl }: Props) {
    const router = useRouter();
    const pathname = usePathname();

    const onClick = useCallback(
        (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();

            // Save PROJECT scroll before anything unmounts
            saveScrollForPath(pathname);

            // Capture the HOME scroll we want to restore to (must have been saved when leaving home)
            const homeY = getScrollForPath("/") ?? 0;
            window.__restoreNextScroll = { path: "/", y: homeY };

            (window as any).__pageTransitionPending = {
                direction: "down",
                fromPath: pathname,
                scrollTop: getCurrentScrollY(),
            };

            const sourceEl = document.querySelector<HTMLElement>(`[data-hero-slug="${slug}"]`);

            if (!sourceEl || !heroImgUrl) {
                router.push("/");
                return;
            }

            startHeroTransition({
                slug,
                sourceEl,
                imgUrl: heroImgUrl,
                onNavigate: () => {
                    router.push("/");

                    // Safety: if the home tile is slow to mount, try to park once.
                    window.setTimeout(() => {
                        const pending = (window as any).__heroPending as { slug?: string } | undefined;
                        if (!pending || pending.slug !== slug) return;

                        const homeTarget = document.querySelector<HTMLElement>(
                            `[data-hero-slug="${slug}"][data-hero-target="home"]`
                        );

                        if (homeTarget) {
                            completeHeroTransition({
                                slug,
                                targetEl: homeTarget,
                                mode: "parkThenPage",
                            });
                        }
                    }, 800);
                },
            });
        },
        [heroImgUrl, pathname, router, slug]
    );

    return (
        <a
            href="/"
            onClick={onClick}
            className="mt-4 inline-flex items-center gap-2 underline underline-offset-4"
        >
            Back
        </a>
    );
}
