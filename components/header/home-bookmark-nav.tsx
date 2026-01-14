//components/header/home-bookmark-nav.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import BookmarkLink from "@/components/header/bookmark-link-fabric";
import ProjectIndexDrawer from "@/components/header/project-index-drawer";

const DRAWER_ID = "home-project-index";
const BOOKMARK_FOLLOWS_DRAWER = true;
const DRAWER_CLOSE_MS = 350;

export default function HomeBookmarkNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const [follow, setFollow] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isHome) setOpen(false);
  }, [isHome]);

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
    setOpen((prev) => !prev);
  }, [isHome]);

  return (
    <>
      <BookmarkLink
        href="/"
        side="left"
        onHomeToggle={toggle}
        ariaControls={isHome ? DRAWER_ID : undefined}
        ariaExpanded={isHome ? open : undefined}
        homeLabel={open ? "Close project index" : "Open project index"}
        homeFollowRef={drawerRef}
        homeFollow={follow}
      />
      {isHome ? <ProjectIndexDrawer id={DRAWER_ID} open={open} panelRef={drawerRef} /> : null}
    </>
  );
}
