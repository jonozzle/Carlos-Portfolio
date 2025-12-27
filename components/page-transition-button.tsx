// components/page-transition-button.tsx
"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { startHeroTransition } from "@/lib/hero-transition";
import type { PageDirection } from "@/lib/transitions/state";
import { saveScrollForPath, getCurrentScrollY } from "@/lib/scroll-state";
import { saveHsProgressNow } from "@/lib/hs-scroll";

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

  const onNavigate = useCallback(() => {
    (window as any).__pageTransitionPending = {
      direction,
      fromPath: pathname,
      scrollTop: getCurrentScrollY(),
    };

    router.push(href);
  }, [direction, href, pathname, router]);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      e.preventDefault();

      // Save current route scroll immediately
      saveScrollForPath(pathname);

      // If leaving HOME, save horizontal progress (this is the real "where I was")
      if (pathname === "/") {
        saveHsProgressNow();
      }

      const slug = heroSlug?.trim();
      const sourceEl = heroSourceRef?.current ?? null;

      if (slug && sourceEl && heroImgUrl) {
        startHeroTransition({
          slug,
          sourceEl,
          imgUrl: heroImgUrl,
          onNavigate,
        });
        return;
      }

      onNavigate();
    },
    [disabled, heroImgUrl, heroSlug, heroSourceRef, onNavigate, pathname]
  );

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
