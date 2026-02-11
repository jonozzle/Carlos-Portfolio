// src: components/header/project-index-drawer.tsx
"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import HeroUnderlineLink from "@/components/ui/hero-underline-link";

type DrawerItem = {
  _key: string;
  title: string;
  slug: string | null;
  year: number | string | null;
  client: string | null;
  col: number | null;
  row: number | null;
};

export type ProjectIndexDrawerData = {
  title: string;
  showNumbers: boolean;
  showProjectDetails: boolean;
  heightDesktop?: string | null;
  heightMobile?: string | null;
  items: DrawerItem[];
} | null;

type ProjectIndexDrawerProps = {
  open: boolean;
  drawer?: ProjectIndexDrawerData;
  id?: string;
  panelRef?: React.RefObject<HTMLDivElement | null>;
  onNavigate?: () => void;
};

// Grid layout (28×28)
const DRAWER_GRID_COLS = 28;
const DRAWER_GRID_ROWS = 28;

// CHANGE THIS to control how wide each project link is in grid mode (in grid columns).
const DRAWER_GRID_ITEM_COL_SPAN = 6;
const MOBILE_DRAWER_QUERY = "(max-width: 767px)";
const DRAWER_OPEN_DUR = 1.1;
const DRAWER_CLOSE_DUR = 0.9;
const DRAWER_OPEN_EASE = "elastic.out(1,1)";
const DRAWER_CLOSE_EASE = "elastic.in(1,1)";
const TOP_FILL_HEIGHT = 240;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.min(max, Math.max(min, v));
}

export default function ProjectIndexDrawer({
  open,
  drawer,
  id,
  panelRef,
  onNavigate,
}: ProjectIndexDrawerProps) {
  const localPanelRef = useRef<HTMLDivElement | null>(null);
  const resolvedPanelRef = panelRef ?? localPanelRef;
  const wasOpenRef = useRef(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  const title = (drawer?.title ?? "Project Index").trim() || "Project Index";
  const showNumbers = !!drawer?.showNumbers;
  const showProjectDetails = drawer?.showProjectDetails ?? true;
  const desktopHeight = drawer?.heightDesktop?.trim();
  const mobileHeight = drawer?.heightMobile?.trim();

  const items = useMemo(() => {
    const raw = drawer?.items ?? [];
    return raw.filter((it) => it && it._key && (it.slug || it.title));
  }, [drawer?.items]);

  useLayoutEffect(() => {
    const panel = resolvedPanelRef.current;
    if (!panel) return;
    gsap.set(panel, { yPercent: -100, autoAlpha: 1, pointerEvents: "none" });
  }, [resolvedPanelRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(MOBILE_DRAWER_QUERY);
    const update = () => setIsMobileLayout(mq.matches);
    update();
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  useEffect(() => {
    const panel = resolvedPanelRef.current;
    if (!panel) return;

    const itemEls = gridRef.current
      ? Array.from(gridRef.current.querySelectorAll<HTMLElement>("[data-drawer-item]"))
      : [];

    gsap.killTweensOf(panel);
    gsap.killTweensOf(itemEls);

    if (!open) {
      if (!wasOpenRef.current) {
        gsap.set(panel, { yPercent: -100, pointerEvents: "none" });
        return;
      }

      gsap.to(panel, {
        yPercent: -100,
        duration: DRAWER_CLOSE_DUR,
        ease: DRAWER_CLOSE_EASE,
        onComplete: () => {
          gsap.set(panel, { pointerEvents: "none" });
        },
      });
      return;
    }

    gsap.set(panel, { pointerEvents: "auto" });
    wasOpenRef.current = true;

    const tl = gsap.timeline({ defaults: { overwrite: "auto" } });

    tl.to(panel, {
      yPercent: 0,
      duration: DRAWER_OPEN_DUR,
      ease: DRAWER_OPEN_EASE,
    });

    if (itemEls.length) {
      tl.fromTo(
        itemEls,
        { y: -12, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.35, ease: "power2.out", stagger: 0.035 },
        "-=0.25"
      );
    }
  }, [open, resolvedPanelRef, items.length]);

  const renderIndexedTitle = (t: string, index: number) => {
    if (!showNumbers) return <span className="inline-block">{t}</span>;
    return (
      <>
        <span className="mr-2 inline-block tabular-nums opacity-70">{pad2(index + 1)}</span>
        <span className="inline-block">{t}</span>
      </>
    );
  };

  const renderProjectDetails = (it: DrawerItem) => {
    if (!showProjectDetails) return null;

    const yearRaw = it.year;
    const year = yearRaw == null ? "" : String(yearRaw).trim();

    const clientRaw = it.client;
    const client = clientRaw == null ? "" : String(clientRaw).trim();

    if (!year && !client) return null;

    return (
      <span className="mt-1 flex flex-col gap-0 text-xs md:text-sm leading-tight tracking-tighter opacity-60">
        {year ? <span className="tabular-nums">{year}</span> : null}
        {client ? <span>{client}</span> : null}
      </span>
    );
  };

  const renderLinkContent = (it: DrawerItem, index: number) => {
    return (
      <span className="inline-flex flex-col items-start">
        <span className="inline-flex items-baseline">
          {renderIndexedTitle(it.title || "Untitled", index)}
        </span>
        {renderProjectDetails(it)}
      </span>
    );
  };

  return (
    <div
      id={id}
      ref={resolvedPanelRef}
      className="fixed inset-x-0 top-0 z-[10005] w-full bg-neutral-50/95 text-neutral-900 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        aria-hidden
        className="absolute left-0 right-0 pointer-events-none bg-neutral-50/95 backdrop-blur-md"
        style={{ height: TOP_FILL_HEIGHT, top: -TOP_FILL_HEIGHT }}
      />
      <div className="mx-auto flex w-full  flex-col gap-6 px-6 py-6">
        <div className="flex justify-center">

          <p className="text-[11px] uppercase text-neutral-500 font-serif">{title}</p>

        </div>

        <div className="w-full">
          <div
            ref={gridRef}
            className="relative w-full min-h-[35vh] max-h-[48vh] overflow-auto rounded-2xl"
            style={
              isMobileLayout
                ? {
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gridAutoRows: "auto",
                  alignItems: "start",
                  justifyItems: "start",
                  columnGap: "1.25rem",
                  rowGap: "0.75rem",
                  minHeight: "auto",
                  maxHeight: mobileHeight || "none",
                }
                : {
                  display: "grid",
                  gridTemplateColumns: `repeat(${DRAWER_GRID_COLS}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${DRAWER_GRID_ROWS}, minmax(0, 1fr))`,
                  alignItems: "start",
                  justifyItems: "start",
                  ...(desktopHeight ? { maxHeight: desktopHeight } : {}),
                }
            }
          >
            {items.length ? (
              items.map((it, index) => {
                const href = it.slug ? `/projects/${it.slug}` : "#";

                let colStart = clampInt(it.col, 1, DRAWER_GRID_COLS, 14);
                const rowStart = clampInt(it.row, 1, DRAWER_GRID_ROWS, 14);
                colStart = Math.min(DRAWER_GRID_COLS - DRAWER_GRID_ITEM_COL_SPAN + 1, colStart);
                const placementStyle = isMobileLayout
                  ? undefined
                  : {
                    gridColumn: `${colStart} / span ${DRAWER_GRID_ITEM_COL_SPAN}`,
                    gridRowStart: rowStart,
                  };

                return (
                  <div
                    key={it._key}
                    data-drawer-item
                    className="pointer-events-auto"
                    style={placementStyle}
                  >
                    <HeroUnderlineLink
                      href={href}
                      active={false}
                      alwaysBold={false}
                      activeTextClassName="font-semibold"
                      className={[
                        "py-1 px-2",
                        "text-lg md:text-xl font-serif font-normal tracking-tighter",
                        "inline-flex flex-col items-start",
                        "opacity-70 hover:opacity-100 focus-visible:opacity-100",
                      ].join(" ")}
                      data-cursor="link"
                      onClick={() => onNavigate?.()}
                    >
                      {renderLinkContent(it, index)}
                    </HeroUnderlineLink>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full row-span-full grid place-items-center text-sm opacity-60">
                No drawer items
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
