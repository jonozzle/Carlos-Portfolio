// components/header/project-index-drawer.tsx
"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

type ProjectIndexDrawerProps = {
  open: boolean;
  id?: string;
  panelRef?: React.RefObject<HTMLDivElement | null>;
};

const DUMMY_LINKS = [
  { title: "Atlas Archives", href: "#" },
  { title: "Copper Field", href: "#" },
  { title: "Halcyon Studio", href: "#" },
  { title: "Lumen Foundry", href: "#" },
  { title: "Morrow & Co.", href: "#" },
  { title: "Northway Lab", href: "#" },
  { title: "Signal Ridge", href: "#" },
  { title: "Violet Works", href: "#" },
  { title: "Wilderness Unit", href: "#" },
];

export default function ProjectIndexDrawer({ open, id, panelRef }: ProjectIndexDrawerProps) {
  const localPanelRef = useRef<HTMLDivElement | null>(null);
  const resolvedPanelRef = panelRef ?? localPanelRef;
  const listRef = useRef<HTMLUListElement | null>(null);

  useLayoutEffect(() => {
    const panel = resolvedPanelRef.current;
    if (!panel) return;
    gsap.set(panel, { yPercent: -100, autoAlpha: 1, pointerEvents: "none" });
  }, [resolvedPanelRef]);

  useEffect(() => {
    const panel = resolvedPanelRef.current;
    if (!panel) return;

    const listItems = listRef.current ? Array.from(listRef.current.children) : [];
    gsap.killTweensOf(panel);
    gsap.killTweensOf(listItems);

    if (!open) {
      gsap.to(panel, {
        yPercent: -100,
        duration: 0.35,
        ease: "power2.in",
        overwrite: "auto",
        onComplete: () => {
          gsap.set(panel, { pointerEvents: "none" });
        },
      });
      return;
    }

    gsap.set(panel, { pointerEvents: "auto" });
    const tl = gsap.timeline({ defaults: { overwrite: "auto" } });

    tl.to(panel, {
      yPercent: 0,
      duration: 0.6,
      ease: "power3.out",
    });

    if (listItems.length) {
      tl.fromTo(
        listItems,
        { y: -12, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.35, ease: "power2.out", stagger: 0.06 },
        "-=0.25"
      );
    }
  }, [open, resolvedPanelRef]);

  return (
    <div
      id={id}
      ref={resolvedPanelRef}
      className="fixed inset-x-0 top-0 z-[10005] w-full bg-neutral-50/95 text-neutral-900 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-10 pt-24">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-500">Project Index</p>
          <span className="text-[11px] uppercase tracking-[0.2em] text-neutral-400">
            Bookmark toggles
          </span>
        </div>
        <ul ref={listRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DUMMY_LINKS.map((item) => (
            <li key={item.title}>
              <a
                href={item.href}
                onClick={(e) => e.preventDefault()}
                className="group flex items-center justify-between border-b border-neutral-200/80 pb-2 text-sm uppercase tracking-[0.18em] text-neutral-700 transition-colors duration-200 hover:text-neutral-900"
              >
                <span>{item.title}</span>
                <span className="text-[10px] tracking-[0.22em] text-neutral-400 transition-colors duration-200 group-hover:text-neutral-600">
                  View
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
