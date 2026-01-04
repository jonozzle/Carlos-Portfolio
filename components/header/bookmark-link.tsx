// components/header/bookmark-link.tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { useLoader } from "@/components/loader/loader-context";
import { APP_EVENTS } from "@/lib/app-events";

type BookmarkLinkProps = {
  href?: string;
  side?: "left" | "right";
  className?: string;
};

export default function BookmarkLink({
  href = "/",
  side = "left",
  className,
}: BookmarkLinkProps) {
  const { loaderDone } = useLoader();
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

    // Sync immediately to current loader state
    if (loaderDone) show();
    else hide();

    return () => {
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_SHOW, onShow);
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_HIDE, onHide);
    };
  }, [hide, show, loaderDone]);

  // Hard sync to loader state (covers missed events)
  useEffect(() => {
    if (!linkRef.current) return;
    if (loaderDone) show();
    else hide();
  }, [loaderDone, show, hide]);

  return (
    <Link
      ref={linkRef}
      href={href}
      aria-label="Home"
      className={cn(
        "group fixed top-0 z-50",
        side === "left" ? "left-6" : "right-6",
        "inline-flex items-start justify-center",
        "h-[92px] w-12",
        // SSR/FOUC-safe defaults
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
    </Link>
  );
}
