// components/project/back-to-home.tsx
"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { startHeroTransition, completeHeroTransition } from "@/lib/hero-transition";
import { getScrollForPath, saveScrollForPath, getCurrentScrollY } from "@/lib/scroll-state";
import { setNavIntent } from "@/lib/nav-intent";

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

            saveScrollForPath(pathname);

            const homeY = getScrollForPath("/") ?? 0;
            setNavIntent({ kind: "project-to-home", restoreY: homeY });

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
        <a href="/" onClick={onClick} className="mt-4 inline-flex items-center gap-2 underline underline-offset-4">
            Back
        </a>
    );
}
