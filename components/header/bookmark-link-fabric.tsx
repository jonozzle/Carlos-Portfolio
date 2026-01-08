// components/header/bookmark-link.tsx
"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { useLoader } from "@/components/loader/loader-context";
import { APP_EVENTS } from "@/lib/app-events";

import { usePathname, useRouter } from "next/navigation";
import { lockAppScroll } from "@/lib/scroll-lock";
import { startHeroTransition } from "@/lib/hero-transition";
import { getSavedHomeSection } from "@/lib/home-section";
import { setNavIntent } from "@/lib/nav-intent";
import { lockHover } from "@/lib/hover-lock";
import { fadeOutPageRoot } from "@/lib/transitions/page-fade";
import type { PageTransitionKind } from "@/lib/transitions/state";

type BookmarkLinkProps = {
  href?: string;
  side?: "left" | "right";
  className?: string;
  slug?: string;
  heroImgUrl?: string;
};

const TOP_THRESHOLD = 24;

function setHomeHold(on: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (on) root.dataset.homeHold = "1";
  else delete (root as any).dataset.homeHold;
}

function extractBgUrl(bg: string | null | undefined) {
  if (!bg || bg === "none") return null;
  const m = bg.match(/url\((['"]?)(.*?)\1\)/i);
  return m?.[2] ?? null;
}

function resolveHeroImgUrl(sourceEl: HTMLElement | null): string | null {
  if (!sourceEl) return null;

  const img = sourceEl.querySelector("img") as HTMLImageElement | null;
  if (img) return img.currentSrc || img.src || null;

  const bg = extractBgUrl(getComputedStyle(sourceEl).backgroundImage);
  if (bg) return bg;

  const anyBg = sourceEl.querySelector<HTMLElement>("[style*='background-image']");
  if (anyBg) {
    const bg2 = extractBgUrl(getComputedStyle(anyBg).backgroundImage);
    if (bg2) return bg2;
  }

  return null;
}

function getRawScrollY(): number {
  if (typeof window === "undefined") return 0;

  const y =
    (typeof window.scrollY === "number" ? window.scrollY : 0) ||
    (typeof document !== "undefined" && typeof document.documentElement?.scrollTop === "number"
      ? document.documentElement.scrollTop
      : 0) ||
    0;

  return Number.isFinite(y) ? Math.max(0, y) : 0;
}

function clearAnyHeroPending() {
  if (typeof window === "undefined") return;
  const p = (window as any).__heroPending as { overlay?: HTMLElement } | undefined;

  try {
    p?.overlay?.remove();
  } catch {
    // ignore
  }

  (window as any).__heroPending = undefined;
  (window as any).__heroDone = true;
}

type Vec2 = { x: number; y: number };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function mul(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function BookmarkLink({
  href = "/",
  side = "left",
  className,
  slug: slugProp,
  heroImgUrl: heroImgUrlProp,
}: BookmarkLinkProps) {
  const { loaderDone } = useLoader();
  const router = useRouter();
  const pathname = usePathname();

  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const shownRef = useRef(false);

  const svgPathRef = useRef<SVGPathElement | null>(null);

  // keep stable id even if not used for filters anymore (future-safe)
  useId();

  const [reduceMotion, setReduceMotion] = useState(false);

  const pull = useRef({ v: 0 }); // 0..1
  const hovering = useRef(false);

  const pointer = useRef({
    active: false,
    x: 24,
    y: 46,
    vx: 0,
    vy: 0,
    lastX: 24,
    lastY: 46,
    lastT: 0,
  });

  const sim = useRef<{
    inited: boolean;
    n: number;
    W: number;
    H: number;
    segLen: number;
    pos: Vec2[];
    prev: Vec2[];
    rest: Vec2[];
    raf: number | null;
    lastT: number;
  }>({
    inited: false,
    n: 14, // more points = more “cloth”
    W: 48,
    H: 92,
    segLen: 0,
    pos: [],
    prev: [],
    rest: [],
    raf: null,
    lastT: 0,
  });

  const hide = useCallback(() => {
    const el = linkRef.current;
    if (!el) return;
    shownRef.current = false;

    gsap.killTweensOf(el);
    gsap.set(el, { pointerEvents: "none" });
    gsap.to(el, { autoAlpha: 0, y: -24, duration: 0.2, ease: "power2.in", overwrite: "auto" });
  }, []);

  const show = useCallback(() => {
    const el = linkRef.current;
    if (!el) return;
    shownRef.current = true;

    gsap.killTweensOf(el);
    gsap.set(el, { pointerEvents: "auto" });
    gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out", overwrite: "auto" });
  }, []);

  const doNavigate = useCallback(async () => {
    const rawY = getRawScrollY();
    const atTop = rawY <= TOP_THRESHOLD;

    const saved = getSavedHomeSection();
    const enteredKind =
      ((window as any).__pageTransitionLast as PageTransitionKind | undefined) ?? "simple";

    const shouldHeroBack =
      href === "/" &&
      pathname !== "/" &&
      enteredKind === "hero" &&
      atTop &&
      saved?.type === "project-block" &&
      !!saved?.id;

    lockAppScroll();
    lockHover();

    setNavIntent({ kind: "project-to-home", homeSectionId: saved?.id ?? null });

    const pushHome = (kind: PageTransitionKind) => {
      (window as any).__pageTransitionPending = {
        direction: "down",
        fromPath: pathname,
        kind,
        homeSectionId: saved?.id ?? null,
        homeSectionType: saved?.type ?? null,
      };
      router.push(href);
    };

    if (!shouldHeroBack) {
      (window as any).__deferHomeThemeReset = false;
      clearAnyHeroPending();

      await fadeOutPageRoot({ duration: 0.8 });

      setHomeHold(true);
      pushHome("simple");
      return;
    }

    // Hero-back
    setHomeHold(false);
    (window as any).__deferHomeThemeReset = true;

    const sourceEl =
      (slugProp
        ? document.querySelector<HTMLElement>(
          `[data-hero-target="project"][data-hero-slug="${CSS.escape(slugProp)}"]`
        )
        : null) ??
      document.querySelector<HTMLElement>(`[data-hero-target="project"][data-hero-slug]`) ??
      document.querySelector<HTMLElement>(`[data-hero-target="project"]`);

    const resolvedSlug =
      slugProp || sourceEl?.getAttribute("data-hero-slug") || (sourceEl as any)?.dataset?.heroSlug || "";

    const resolvedImgUrl = heroImgUrlProp || resolveHeroImgUrl(sourceEl);

    if (!sourceEl || !resolvedSlug || !resolvedImgUrl) {
      (window as any).__deferHomeThemeReset = false;
      clearAnyHeroPending();

      await fadeOutPageRoot({ duration: 0.8 });
      setHomeHold(true);
      pushHome("simple");
      return;
    }

    startHeroTransition({
      slug: resolvedSlug,
      sourceEl,
      imgUrl: resolvedImgUrl,
      onNavigate: () => pushHome("hero"),
    });
  }, [heroImgUrlProp, href, pathname, router, slugProp]);

  const clickLock = useRef(false);

  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (pathname === "/") {
        e.preventDefault();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      e.preventDefault();
      if (clickLock.current) return;
      clickLock.current = true;

      try {
        // Pull-down tug first, then navigate.
        await new Promise<void>((resolve) => {
          gsap.timeline({ defaults: { overwrite: "auto" }, onComplete: resolve })
            .to(pull.current, { v: 1, duration: 0.10, ease: "power2.out" })
            .to(pull.current, { v: 0, duration: 0.18, ease: "power2.in" });
        });

        await doNavigate();
      } finally {
        clickLock.current = false;
      }
    },
    [doNavigate, pathname]
  );

  // Reduced motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(!!mq.matches);
    apply();

    try {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } catch {
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, []);

  // Show/hide hook-up
  useEffect(() => {
    const el = linkRef.current;
    if (!el) return;

    gsap.set(el, { autoAlpha: 0, y: -24, pointerEvents: "none", willChange: "transform,opacity" });

    const onShow = () => show();
    const onHide = () => hide();

    window.addEventListener(APP_EVENTS.UI_BOOKMARK_SHOW, onShow);
    window.addEventListener(APP_EVENTS.UI_BOOKMARK_HIDE, onHide);

    if (loaderDone) show();
    else hide();

    return () => {
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_SHOW, onShow);
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_HIDE, onHide);
    };
  }, [hide, show, loaderDone]);

  useEffect(() => {
    if (!linkRef.current) return;
    if (loaderDone) show();
    else hide();
  }, [loaderDone, show, hide]);

  const initSim = useCallback(() => {
    const s = sim.current;
    if (s.inited) return;

    const N = s.n;
    const W = s.W;
    const H = s.H;

    const top = { x: W / 2, y: 0 };
    const bottom = { x: W / 2, y: H };

    s.segLen = (bottom.y - top.y) / (N - 1);

    s.pos = new Array(N);
    s.prev = new Array(N);
    s.rest = new Array(N);

    for (let i = 0; i < N; i++) {
      const p = { x: top.x, y: top.y + i * s.segLen };
      s.pos[i] = { ...p };
      s.prev[i] = { ...p };
      s.rest[i] = { ...p };
    }

    s.inited = true;
  }, []);

  const buildPathD = useCallback(() => {
    const s = sim.current;
    const pathEl = svgPathRef.current;
    if (!s.inited || !pathEl) return;

    const N = s.n;
    const H = s.H;

    // Keep the bookmark from looking “bloated”: constant, slim width like your old w-4 (16px).
    const widthAt = (_t: number) => 16;

    const left: Vec2[] = [];
    const right: Vec2[] = [];

    for (let i = 0; i < N; i++) {
      const p = s.pos[i];
      const pPrev = s.pos[Math.max(0, i - 1)];
      const pNext = s.pos[Math.min(N - 1, i + 1)];

      const tng = normalize(sub(pNext, pPrev));
      const nrm = { x: -tng.y, y: tng.x };

      const t = i / (N - 1);
      const halfW = widthAt(t) / 2;

      left.push(add(p, mul(nrm, halfW)));
      right.push(sub(p, mul(nrm, halfW)));
    }

    // Tail notch (like your clipped polygon)
    const last = s.pos[N - 1];
    const notchDepth = 18;
    const notchY = clamp(last.y - notchDepth, 0, H);
    const notch = { x: last.x, y: notchY };

    const f = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");

    let d = `M ${f(left[0].x)} ${f(left[0].y)} `;
    for (let i = 1; i < N; i++) d += `L ${f(left[i].x)} ${f(left[i].y)} `;
    d += `L ${f(notch.x)} ${f(notch.y)} `;
    d += `L ${f(right[N - 1].x)} ${f(right[N - 1].y)} `;
    for (let i = N - 2; i >= 0; i--) d += `L ${f(right[i].x)} ${f(right[i].y)} `;
    d += "Z";

    pathEl.setAttribute("d", d);
  }, []);

  const stepSim = useCallback(
    (now: number) => {
      const s = sim.current;
      if (!s.inited) return;

      const dt = s.lastT ? clamp((now - s.lastT) / 1000, 0.008, 0.033) : 0.016;
      s.lastT = now;

      const N = s.n;
      const W = s.W;
      const H = s.H;

      // Tuning: increased response, but stable (no texture/shadow)
      const damping = 0.976; // closer to 1 = more lively
      const gravity = 140;
      const tether = 10; // lower = looser cloth response
      const windStrength = 520; // stronger response to mouse
      const pointerSpring = 42; // direct “fabric follows pointer” force
      const pointerSpringY = 24;

      const pInfo = pointer.current;
      const hoverBoost = hovering.current ? 1 : 0;

      // Integrate (verlet)
      for (let i = 0; i < N; i++) {
        if (i === 0) {
          s.pos[i].x = s.rest[i].x;
          s.pos[i].y = s.rest[i].y;
          s.prev[i].x = s.rest[i].x;
          s.prev[i].y = s.rest[i].y;
          continue;
        }

        const p = s.pos[i];
        const prev = s.prev[i];

        const vx = (p.x - prev.x) * damping;
        const vy = (p.y - prev.y) * damping;

        let ax = 0;
        let ay = gravity;

        // Tether to rest keeps overall silhouette bookmark-like
        ax += (s.rest[i].x - p.x) * tether;
        ay += (s.rest[i].y - p.y) * tether;

        // Pointer influence
        if (pInfo.active) {
          const dx = pInfo.x - p.x;
          const dy = pInfo.y - p.y;
          const r = Math.hypot(dx, dy) || 1;

          // Slightly larger radius than before for stronger, smoother feel
          const falloff = 1 / (1 + (r / 28) * (r / 28));

          // More effect lower down
          const t = i / (N - 1);

          // “Follow” spring + “wind” from pointer velocity
          ax += dx * pointerSpring * falloff * t;
          ay += dy * pointerSpringY * falloff * t;

          ax += pInfo.vx * windStrength * falloff * t;
          ay += pInfo.vy * windStrength * falloff * t;
        }

        // Subtle idle motion when hovering (keeps it “alive”)
        if (hoverBoost) {
          ax += Math.sin(now / 210 + i * 0.55) * 14;
          ay += Math.cos(now / 240 + i * 0.45) * 8;
        }

        // Click pull: tug the lower part down
        const pullAmt = pull.current.v;
        if (pullAmt > 0.0001) {
          const t = i / (N - 1);
          ay += pullAmt * 1400 * t;
        }

        const nextX = p.x + vx + ax * dt * dt;
        const nextY = p.y + vy + ay * dt * dt;

        s.prev[i].x = p.x;
        s.prev[i].y = p.y;
        p.x = nextX;
        p.y = nextY;
      }

      // Constraints
      const iterations = 5; // stronger cloth behavior while keeping silhouette
      for (let it = 0; it < iterations; it++) {
        for (let i = 1; i < N; i++) {
          const p0 = s.pos[i - 1];
          const p1 = s.pos[i];

          const target = s.segLen;
          const d = dist(p0, p1) || 1;
          const diff = (d - target) / d;

          if (i === 1) {
            p1.x -= (p1.x - p0.x) * diff;
            p1.y -= (p1.y - p0.y) * diff;
          } else {
            p0.x += (p1.x - p0.x) * diff * 0.18;
            p0.y += (p1.y - p0.y) * diff * 0.18;
            p1.x -= (p1.x - p0.x) * diff * 0.82;
            p1.y -= (p1.y - p0.y) * diff * 0.82;
          }
        }

        // Re-anchor top
        s.pos[0].x = s.rest[0].x;
        s.pos[0].y = s.rest[0].y;
      }

      // Keep it inside a box that matches the original footprint (avoid “bloat”)
      for (let i = 1; i < N; i++) {
        s.pos[i].x = clamp(s.pos[i].x, 8, W - 8);
        s.pos[i].y = clamp(s.pos[i].y, 0, H + 10);
      }

      buildPathD();
    },
    [buildPathD]
  );

  const startLoop = useCallback(() => {
    const s = sim.current;
    if (s.raf) return;

    const tick = (t: number) => {
      if (reduceMotion) {
        if (!s.inited) return;
        buildPathD();
        s.raf = null;
        return;
      }

      stepSim(t);
      s.raf = window.requestAnimationFrame(tick);
    };

    s.raf = window.requestAnimationFrame(tick);
  }, [buildPathD, reduceMotion, stepSim]);

  const stopLoop = useCallback(() => {
    const s = sim.current;
    if (s.raf) {
      window.cancelAnimationFrame(s.raf);
      s.raf = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    initSim();
    buildPathD();
    startLoop();
    return () => stopLoop();
  }, [buildPathD, initSim, startLoop, stopLoop]);

  // Pointer handling in local SVG coords
  const updatePointer = useCallback((clientX: number, clientY: number) => {
    const a = linkRef.current;
    if (!a) return;

    const r = a.getBoundingClientRect();
    const W = sim.current.W;
    const H = sim.current.H;

    const x = clamp(((clientX - r.left) / r.width) * W, 0, W);
    const y = clamp(((clientY - r.top) / r.height) * H, 0, H);

    const now = performance.now();
    const p = pointer.current;

    const dt = p.lastT ? clamp((now - p.lastT) / 1000, 0.008, 0.05) : 0.016;
    const vx = (x - p.lastX) / dt;
    const vy = (y - p.lastY) / dt;

    // Increased response: less division than before
    p.vx = clamp(vx / 700, -1.2, 1.2);
    p.vy = clamp(vy / 700, -1.2, 1.2);

    p.x = x;
    p.y = y;
    p.lastX = x;
    p.lastY = y;
    p.lastT = now;
  }, []);

  const onPointerEnter = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      hovering.current = true;
      pointer.current.active = true;
      updatePointer(e.clientX, e.clientY);
    },
    [updatePointer]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      pointer.current.active = true;
      updatePointer(e.clientX, e.clientY);
    },
    [updatePointer]
  );

  const onPointerLeave = useCallback(() => {
    hovering.current = false;
    pointer.current.active = false;
    pointer.current.vx *= 0.2;
    pointer.current.vy *= 0.2;
  }, []);

  const svg = useMemo(() => {
    return (
      <svg
        aria-hidden
        className="block h-full w-full pointer-events-none"
        viewBox="0 0 48 92"
        preserveAspectRatio="xMidYMin meet"
      >
        <path
          ref={svgPathRef}
          d="M 16 0 L 16 92 L 24 74 L 32 92 L 32 0 Z"
          fill="rgb(239 68 68)" // red-500
        />
      </svg>
    );
  }, []);

  return (
    <a
      ref={linkRef}
      href={href}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      aria-label="Back"
      style={{ touchAction: "none" }}
      className={cn(
        "group fixed top-0 z-50",
        side === "left" ? "left-6" : "right-6",
        "inline-flex items-start justify-center",
        "h-[92px] w-12",
        "opacity-0",
        className
      )}
    >
      {svg}
    </a>
  );
}
