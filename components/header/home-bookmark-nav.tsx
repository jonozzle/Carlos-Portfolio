//components/header/home-bookmark-nav.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import BookmarkLink from "@/components/header/bookmark-link-cloth";
import ProjectIndexDrawer from "@/components/header/project-index-drawer";
import BioBlock from "@/components/blocks/hero/bio-block";
import { useHeroBioData } from "@/lib/hero-bio-store";
import type { ProjectIndexDrawerData } from "@/components/header/project-index-drawer";

const DRAWER_ID = "home-project-index";
const BOOKMARK_FOLLOWS_DRAWER = true;
const DRAWER_CLOSE_MS = 1100;
const SHOW_BOOKMARK_LABEL = false;
const PRINT_BOOKMARK_LABEL = true;
const ENABLE_BOOKMARK = true;

type HomeBookmarkNavProps = {
  drawer?: ProjectIndexDrawerData;
};

export default function HomeBookmarkNav({ drawer }: HomeBookmarkNavProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const [follow, setFollow] = useState(false);
  const bio = useHeroBioData();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isHome) setOpen(false);
  }, [isHome]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (!BOOKMARK_FOLLOWS_DRAWER || !isHome) {
      setFollow(false);
      return;
    }

    if (open) {
      setFollow(true);
      return;
    }

    setFollow(true);
    closeTimerRef.current = window.setTimeout(() => {
      setFollow(false);
      closeTimerRef.current = null;
    }, DRAWER_CLOSE_MS);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isHome, open]);

  const toggle = useCallback(() => {
    if (!isHome) return;
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [isHome, open]);

  useEffect(() => {
    if (!isHome || !open) return;

    const closeIfOutside = (target: EventTarget | null) => {
      const panel = drawerRef.current;
      if (!panel || !(target instanceof Node)) return;
      if (target instanceof Element) {
        const fromBookmark =
          target.closest("[data-bookmark-hit='true']") ||
          target.closest("[data-bookmark-link='true']");
        if (fromBookmark) return;
      }
      if (panel.contains(target)) return;
      setOpen(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      closeIfOutside(e.target);
    };

    const onMouseDown = (e: MouseEvent) => {
      closeIfOutside(e.target);
    };

    const onTouchStart = (e: TouchEvent) => {
      closeIfOutside(e.target);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("touchstart", onTouchStart, true);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("touchstart", onTouchStart, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isHome, open]);

  const bookmarkLabel = isHome ? (open ? "Close" : "Index") : "Home";

  return (
    <>
      {ENABLE_BOOKMARK ? (
        <BookmarkLink
          href="/"
          side="left"
          bookmarkLabel={bookmarkLabel}
          showBookmarkLabel={SHOW_BOOKMARK_LABEL}
          printBookmarkLabel={PRINT_BOOKMARK_LABEL}
          onHomeToggle={toggle}
          ariaControls={isHome ? DRAWER_ID : undefined}
          ariaExpanded={isHome ? open : undefined}
          homeLabel={open ? "Close project index" : "Open project index"}
          homeFollowRef={drawerRef}
          homeFollow={follow}
        />
      ) : null}
      {isHome ? (
        <ProjectIndexDrawer
          id={DRAWER_ID}
          open={open}
          panelRef={drawerRef}
          drawer={drawer}
          onNavigate={close}
        />
      ) : null}
      {isHome && bio ? (
        <div className="fixed right-3 top-3 z-[10020] md:hidden">
          <BioBlock
            showBioText={bio.showBioText}
            showBioLinks={bio.showBioLinks}
            enableAnimation={bio.enableAnimation}
            body={bio.body}
            dropCap={bio.dropCap}
            links={bio.links}
            interaction="click"
          />
        </div>
      ) : null}
    </>
  );
}
