// components/header/bookmark-link-fabric.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/**
 * Toggle fabric grab/drag interactivity.
 */
const ENABLE_FABRIC_DRAG = true;

type BookmarkLinkFabricProps = {
  href?: string;
  side?: "left" | "right";
  className?: string;
  slug?: string;
  heroImgUrl?: string;
  onHomeToggle?: () => void;
  homeLabel?: string;
  ariaControls?: string;
  ariaExpanded?: boolean;
  homeFollowRef?: React.RefObject<HTMLElement | null>;
  homeFollow?: boolean;
};

const TOP_THRESHOLD = 24;
const TUG_COOLDOWN_MS = 1000;

const BOOKMARK_TALL_VH = 0.5;

const BASE_RECT_HEIGHT = 24;
const TAIL_HEIGHT = 40;
const BASE_SHAPE_HEIGHT = BASE_RECT_HEIGHT + TAIL_HEIGHT;

const HOME_ANCHOR_HEIGHT = 92;

// Visual “drop” for the UI element (separate from drawer-follow y)
const DROP_INNER_Y = -100;

// Intro “fabric fall”
const REVEAL_LIFT_PX = -120;
const REVEAL_KICK_PULL = 17000;
const INTRO_FLUTTER_MS = 1200;
const INTRO_FLUTTER_SCALE = 0.1;

// “fabric-ness” during size/visibility animations
const ANIM_WIND_MS = 600;
const SIZE_WIND_KICK = 0.05;
const SIZE_VEL_TURBULENCE = 0.01;

// Grab behavior
const GRAB_HOLD_MS = 90;
const GRAB_MOVE_PX = 2;

// Return behavior (release should “fall back” instead of snapping)
const RETURN_MS = 950;

// Viewport clamp padding (lets you pull slightly off-screen)
const VIEWPORT_PAD = 140;

// Target brand red
const RED_500 = { r: 251 / 255, g: 44 / 255, b: 54 / 255 };

type StoredSize = { height: number; extra: number };

function getStoredSize(): StoredSize | null {
  if (typeof window === "undefined") return null;
  const v = (window as any).__bookmarkLastSize as StoredSize | undefined;
  if (!v || typeof v.height !== "number") return null;
  return { height: v.height, extra: typeof v.extra === "number" ? v.extra : 0 };
}

function setStoredSize(next: StoredSize) {
  if (typeof window === "undefined") return;
  (window as any).__bookmarkLastSize = next;
}

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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeOutCubic(t: number) {
  const u = clamp(t, 0, 1);
  return 1 - Math.pow(1 - u, 3);
}

/**
 * If the bookmark lives inside a transformed ancestor (GSAP/Smoother/etc),
 * translateY told to a fixed element can behave in that ancestor’s coordinate system.
 * Subtract that ancestor’s top so rect.bottom aligns correctly.
 */
function getTransformedAncestor(el: HTMLElement | null): HTMLElement | null {
  if (!el || typeof window === "undefined" || typeof document === "undefined") return null;
  let p = el.parentElement;
  while (p && p !== document.body) {
    const st = getComputedStyle(p);
    if (st.transform !== "none" || st.perspective !== "none" || st.filter !== "none") return p;
    p = p.parentElement;
  }
  return null;
}

// Avoid heavy size tweening while the hero overlay is animating.
function isHeroOverlayBusy() {
  if (typeof window === "undefined") return false;
  const pending = (window as any).__heroPending as { overlay?: HTMLElement } | undefined;
  const overlay = pending?.overlay;
  if (!overlay) return false;
  return overlay.dataset?.heroTweening === "1" || overlay.dataset?.heroParked === "1";
}

function createShader(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;

  gl.shaderSource(sh, src);
  gl.compileShader(sh);

  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.error(gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }

  return sh;
}

function createProgram(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;

  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    // eslint-disable-next-line no-console
    console.error(gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }

  return prog;
}

export default function BookmarkLinkFabric({
  href = "/",
  side = "left",
  className,
  slug: slugProp,
  heroImgUrl: heroImgUrlProp,
  onHomeToggle,
  homeLabel,
  ariaControls,
  ariaExpanded,
  homeFollowRef,
  homeFollow,
}: BookmarkLinkFabricProps) {
  const { loaderDone } = useLoader();
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";

  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const innerWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clothHostRef = useRef<HTMLDivElement | null>(null);

  const [overlayEl, setOverlayEl] = useState<HTMLElement | null>(null);
  const createdOverlayRef = useRef(false);

  const shownRef = useRef(false);

  const stored0 = getStoredSize();
  const sizeProxyRef = useRef({
    height: stored0?.height ?? 0,
    extra: stored0?.extra ?? 0,
  });
  const sizeTweenRef = useRef<gsap.core.Tween | null>(null);

  const sizeMotionRef = useRef({
    lastH: stored0?.height ?? 0,
    vel: 0,
  });

  const [webglOk, setWebglOk] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasReadyRef = useRef(false);

  const pull = useRef({ v: 0 });
  const lastTugAtRef = useRef(0);

  const reveal = useRef({ v: 0 });
  const introRef = useRef<{ t0: number; active: boolean }>({ t0: 0, active: false });

  const release = useRef({ v: 0 }); // helps the “fall back” feel on release

  const animWind = useRef({ v: 0 });
  const animWindTweenRef = useRef<gsap.core.Animation | null>(null);

  const simApiRef = useRef<{ reset: (liftPx: number) => void } | null>(null);
  const pendingResetLiftRef = useRef<number | null>(null);

  const dragRef = useRef({
    down: false,
    moved: false,
    startX: 0,
    startY: 0,
    downAt: 0,
    suppressClick: false,
    pointerId: -1,
    dragIndex: -1,
    targetX: 0,
    targetY: 0,
    mode: "idle" as "idle" | "grab" | "return",
    returnT0: 0,
  });

  const pointerRef = useRef({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
  });

  // Overlay container (portal) so it’s not clipped/affected by transformed ancestors
  useEffect(() => {
    if (typeof document === "undefined") return;

    let el = document.getElementById("bookmark-fabric-overlay") as HTMLElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = "bookmark-fabric-overlay";
      el.style.position = "fixed";
      el.style.inset = "0";
      el.style.pointerEvents = "none";
      el.style.background = "transparent";
      el.style.zIndex = "10009"; // under the anchor (10010)
      document.body.appendChild(el);
      createdOverlayRef.current = true;
    }

    setOverlayEl(el);

    return () => {
      if (createdOverlayRef.current) {
        try {
          el?.remove();
        } catch {
          // ignore
        }
      }
      createdOverlayRef.current = false;
    };
  }, []);

  const kickAnimWind = useCallback((amp = 1) => {
    animWindTweenRef.current?.kill();
    animWind.current.v = Math.max(animWind.current.v, 0);

    animWindTweenRef.current = gsap
      .timeline({ defaults: { overwrite: "auto" } })
      .to(animWind.current, { v: Math.max(0.35, amp), duration: 0.12, ease: "power2.out" })
      .to(animWind.current, { v: 0, duration: ANIM_WIND_MS / 1000, ease: "power2.out" });
  }, []);

  const kickRelease = useCallback(() => {
    gsap.killTweensOf(release.current);
    release.current.v = 0;
    gsap
      .timeline({ defaults: { overwrite: "auto" } })
      .to(release.current, { v: 1, duration: 0.12, ease: "power2.out" })
      .to(release.current, { v: 0, duration: 0.55, ease: "power2.out" });
  }, []);

  const applySize = useCallback((height: number, extra: number) => {
    const el = linkRef.current;
    if (!el) return;

    sizeProxyRef.current.height = height;
    sizeProxyRef.current.extra = extra;

    const lastH = sizeMotionRef.current.lastH;
    const dh = height - lastH;
    sizeMotionRef.current.lastH = height;
    sizeMotionRef.current.vel = sizeMotionRef.current.vel * 0.75 + dh * 0.25;

    gsap.set(el, { height });
    el.style.setProperty("--bookmark-total", `${height}px`);
    el.style.setProperty("--bookmark-extra", `${extra}px`);

    setStoredSize({ height, extra });
  }, []);

  const computeTargetSize = useCallback(() => {
    if (typeof window === "undefined") {
      const h = HOME_ANCHOR_HEIGHT;
      return { height: h, extra: Math.max(0, h - BASE_SHAPE_HEIGHT) };
    }
    const targetHeight = isHome ? HOME_ANCHOR_HEIGHT : window.innerHeight * BOOKMARK_TALL_VH;
    const targetExtra = Math.max(0, targetHeight - BASE_SHAPE_HEIGHT);
    return { height: targetHeight, extra: targetExtra };
  }, [isHome]);

  const updateSize = useCallback(
    (immediate?: boolean) => {
      const { height: targetHeight, extra: targetExtra } = computeTargetSize();

      sizeTweenRef.current?.kill();

      if (immediate || isHeroOverlayBusy()) {
        applySize(targetHeight, targetExtra);
        return;
      }

      kickAnimWind(SIZE_WIND_KICK);

      const proxy = sizeProxyRef.current;
      sizeTweenRef.current = gsap.to(proxy, {
        height: targetHeight,
        extra: targetExtra,
        duration: 1.1,
        ease: "power2.out",
        overwrite: "auto",
        onUpdate: () => applySize(proxy.height, proxy.extra),
      });
    },
    [applySize, computeTargetSize, kickAnimWind]
  );

  useEffect(() => {
    if (!shownRef.current) return;
    updateSize(false);
  }, [isHome, updateSize]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => updateSize(true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateSize]);

  const kickReveal = useCallback(() => {
    introRef.current = { t0: performance.now(), active: true };

    gsap.killTweensOf(reveal.current);
    reveal.current.v = 0;

    gsap
      .timeline({ defaults: { overwrite: "auto" } })
      .to(reveal.current, { v: 1, duration: 0.14, ease: "power2.out" })
      .to(reveal.current, { v: 0, duration: 0.55, ease: "power2.out" });
  }, []);

  const hide = useCallback((immediate?: boolean) => {
    const el = linkRef.current;
    if (!el) return;

    shownRef.current = false;

    gsap.killTweensOf(el, "autoAlpha");
    gsap.set(el, { pointerEvents: "none" });

    if (innerWrapRef.current) gsap.killTweensOf(innerWrapRef.current, "y");

    if (immediate) {
      gsap.set(el, { autoAlpha: 0 });
      return;
    }

    gsap.to(el, { autoAlpha: 0, duration: 0.15, ease: "power2.out", overwrite: "auto" });
  }, []);

  const show = useCallback(() => {
    const el = linkRef.current;
    const inner = innerWrapRef.current;
    if (!el || !inner) return;

    const wasShown = shownRef.current;
    shownRef.current = true;

    updateSize(false);

    gsap.killTweensOf(el, "autoAlpha");
    gsap.set(el, { pointerEvents: "auto" });
    gsap.to(el, { autoAlpha: 1, duration: 0.15, ease: "power2.out", overwrite: "auto" });

    if (!wasShown) {
      gsap.killTweensOf(inner, "y");
      gsap.set(inner, { y: DROP_INNER_Y });
      gsap.to(inner, { y: 0, duration: 0.65, ease: "power3.out", overwrite: "auto" });

      if (simApiRef.current) simApiRef.current.reset(REVEAL_LIFT_PX);
      else pendingResetLiftRef.current = REVEAL_LIFT_PX;

      kickReveal();
      kickAnimWind(1);
    }
  }, [kickAnimWind, kickReveal, updateSize]);

  // Follow drawer
  const followActive = !!(isHome && homeFollow && homeFollowRef?.current);

  useEffect(() => {
    const el = linkRef.current;
    if (!el) return;

    let raf = 0;
    const setY = gsap.quickSetter(el, "y", "px") as (v: number) => void;
    const transformedAncestor = getTransformedAncestor(el);

    if (followActive) {
      gsap.killTweensOf(el, "y");

      const tick = () => {
        const target = homeFollowRef?.current;
        if (target) {
          const rect = target.getBoundingClientRect();
          const ancTop = transformedAncestor ? transformedAncestor.getBoundingClientRect().top : 0;

          // Align bookmark TOP to drawer BOTTOM
          setY(rect.bottom - ancTop);
        }
        raf = window.requestAnimationFrame(tick);
      };

      tick();
      return () => window.cancelAnimationFrame(raf);
    }

    window.cancelAnimationFrame(raf);
    gsap.killTweensOf(el, "y");
    gsap.to(el, { y: 0, duration: 0.35, ease: "power2.out", overwrite: "auto" });

    return () => window.cancelAnimationFrame(raf);
  }, [followActive, homeFollowRef]);

  const doNavigate = useCallback(async () => {
    const rawY = getRawScrollY();
    const atTop = rawY <= TOP_THRESHOLD;

    const saved = getSavedHomeSection();
    const enteredKind =
      ((window as any).__pageTransitionLast as PageTransitionKind | undefined) ?? "simple";

    const isHeroBackType = saved?.type === "project-block" || saved?.type === "page-link-section";

    const shouldHeroBack =
      href === "/" &&
      pathname !== "/" &&
      enteredKind === "hero" &&
      atTop &&
      isHeroBackType &&
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
      slugProp ||
      sourceEl?.getAttribute("data-hero-slug") ||
      (sourceEl as any)?.dataset?.heroSlug ||
      "";

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
      if (dragRef.current.suppressClick) {
        e.preventDefault();
        return;
      }

      if (isHome) {
        e.preventDefault();
        onHomeToggle?.();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      e.preventDefault();
      if (clickLock.current) return;
      clickLock.current = true;

      try {
        const now = performance.now();
        if (now - lastTugAtRef.current > TUG_COOLDOWN_MS) {
          lastTugAtRef.current = now;
          gsap.killTweensOf(pull.current);
          pull.current.v = 0;

          await new Promise<void>((resolve) => {
            gsap
              .timeline({ defaults: { overwrite: "auto" }, onComplete: resolve })
              .to(pull.current, { v: 1, duration: 0.1, ease: "power2.out" })
              .to(pull.current, { v: 0, duration: 0.18, ease: "power2.in" });
          });
        }

        await doNavigate();
      } finally {
        clickLock.current = false;
      }
    },
    [doNavigate, isHome, onHomeToggle]
  );

  // Show/hide hook-up
  useEffect(() => {
    const el = linkRef.current;
    const inner = innerWrapRef.current;
    if (!el || !inner) return;

    gsap.set(el, {
      autoAlpha: 0,
      pointerEvents: "none",
      willChange: "transform,opacity,height",
      y: 0,
    });

    gsap.set(inner, { y: 0, willChange: "transform" });

    const stored = getStoredSize();
    if (stored) applySize(stored.height, stored.extra);
    else {
      const { height, extra } = computeTargetSize();
      applySize(height, extra);
    }

    const onShow = () => show();
    const onHide = () => hide();

    window.addEventListener(APP_EVENTS.UI_BOOKMARK_SHOW, onShow);
    window.addEventListener(APP_EVENTS.UI_BOOKMARK_HIDE, onHide);

    if (loaderDone) show();
    else hide(true);

    return () => {
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_SHOW, onShow);
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_HIDE, onHide);
    };
  }, [applySize, computeTargetSize, hide, show, loaderDone]);

  // Pointer in VIEWPORT coords (canvas is full-viewport)
  const updatePointer = useCallback((clientX: number, clientY: number) => {
    const x = clientX;
    const y = clientY;

    const now = performance.now();
    const p = pointerRef.current;
    const dt = p.lastT ? clamp((now - p.lastT) / 1000, 0.008, 0.05) : 0.016;

    const vx = (x - p.lastX) / dt;
    const vy = (y - p.lastY) / dt;

    p.vx = clamp(vx / 900, -1.5, 1.5);
    p.vy = clamp(vy / 900, -1.5, 1.5);

    p.x = x;
    p.y = y;
    p.lastX = x;
    p.lastY = y;
    p.lastT = now;

    if (dragRef.current.down) {
      dragRef.current.targetX = x;
      dragRef.current.targetY = y;
    }
  }, []);

  const pointInAnchor = useCallback((clientX: number, clientY: number) => {
    const el = linkRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      if (e.button !== 0) return;

      const a = linkRef.current;
      if (!a) return;

      pointerRef.current.active = true;
      updatePointer(e.clientX, e.clientY);

      dragRef.current.suppressClick = false;

      if (!ENABLE_FABRIC_DRAG) return;

      dragRef.current.down = true;
      dragRef.current.moved = false;
      dragRef.current.dragIndex = -1;
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
      dragRef.current.downAt = performance.now();
      dragRef.current.pointerId = e.pointerId;

      // don’t kill return instantly; only if they start a new grab
      if (dragRef.current.mode === "return") dragRef.current.mode = "idle";

      try {
        a.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    [updatePointer]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      updatePointer(e.clientX, e.clientY);

      if (!ENABLE_FABRIC_DRAG) return;
      if (!dragRef.current.down) return;

      const now = performance.now();
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const dist = Math.hypot(dx, dy);

      if (!dragRef.current.moved && dist > GRAB_MOVE_PX) {
        dragRef.current.moved = true;
      }

      if (dragRef.current.mode !== "grab") {
        const heldLongEnough = now - dragRef.current.downAt >= GRAB_HOLD_MS;
        if (heldLongEnough && dragRef.current.moved) {
          dragRef.current.mode = "grab";
          dragRef.current.suppressClick = true;
        }
      }
    },
    [updatePointer]
  );

  const endPointer = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      const wasDown = dragRef.current.down;
      const wasGrab = dragRef.current.mode === "grab";

      dragRef.current.down = false;
      dragRef.current.pointerId = -1;
      dragRef.current.dragIndex = -1;

      if (wasGrab) {
        dragRef.current.mode = "return";
        dragRef.current.returnT0 = performance.now();
        kickRelease();
        kickAnimWind(0.9);
      } else {
        dragRef.current.mode = dragRef.current.mode === "grab" ? "idle" : dragRef.current.mode;
      }

      if (wasDown && !pointInAnchor(e.clientX, e.clientY)) {
        pointerRef.current.active = false;
        pointerRef.current.vx *= 0.25;
        pointerRef.current.vy *= 0.25;
      }

      if (dragRef.current.suppressClick) {
        window.setTimeout(() => {
          dragRef.current.suppressClick = false;
        }, 0);
      }

      try {
        linkRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    [kickAnimWind, kickRelease, pointInAnchor]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      endPointer(e);
    },
    [endPointer]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      endPointer(e);
    },
    [endPointer]
  );

  const onPointerEnter = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      pointerRef.current.active = true;
      updatePointer(e.clientX, e.clientY);
    },
    [updatePointer]
  );

  const onPointerLeave = useCallback(() => {
    if (dragRef.current.down) return;
    pointerRef.current.active = false;
    pointerRef.current.vx *= 0.25;
    pointerRef.current.vy *= 0.25;
  }, []);

  // WebGL cloth
  useEffect(() => {
    if (typeof window === "undefined") return;

    const canvas = canvasRef.current;
    const host = clothHostRef.current;
    if (!canvas || !host) return;

    let isActive = true;
    canvasReadyRef.current = false;
    setCanvasReady(false);

    simApiRef.current = null;

    const gl =
      canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      }) ?? null;

    if (!gl) {
      setWebglOk(false);
      return;
    }

    const deriv = gl.getExtension("OES_standard_derivatives");
    const hasDeriv = !!deriv;

    const vs = `
      attribute vec3 a_position;
      attribute vec2 a_uv;

      uniform vec2 u_canvas;

      varying vec2 v_uv;

      void main() {
        vec2 zeroToOne = a_position.xy / u_canvas;
        vec2 clip = vec2(zeroToOne.x * 2.0 - 1.0, 1.0 - zeroToOne.y * 2.0);

        gl_Position = vec4(clip, 0.0, 1.0);
        v_uv = a_uv;
      }
    `;

    const fsHeader = hasDeriv
      ? `#extension GL_OES_standard_derivatives : enable
#define HAS_DERIV 1
`
      : `#define HAS_DERIV 0
`;

    const fs = `
      ${fsHeader}
      precision mediump float;

      varying vec2 v_uv;

      uniform vec3 u_color;
      uniform float u_totalH;
      uniform float u_topH;
      uniform float u_tailH;

      float aaWidth(float v) {
      #if HAS_DERIV
        return fwidth(v) * 1.25 + 0.0005;
      #else
        return 0.02;
      #endif
      }

      float sat(float x) { return clamp(x, 0.0, 1.0); }

      void main() {
        float totalH = max(u_totalH, 1.0);
        float topH = max(u_topH, 1.0);
        float tailH = max(u_tailH, 1.0);

        float apexV = (topH + 0.72 * tailH) / totalH;

        float u = v_uv.x - 0.5;
        float v = v_uv.y;

        float sideEdge = abs(u) - 0.5;
        float sideAA = aaWidth(sideEdge);
        float side = 1.0 - smoothstep(0.0, sideAA, sideEdge);

        float notch = 1.0;
        if (v >= apexV) {
          float t = (v - apexV) / (1.0 - apexV);
          float cutHalf = 0.5 * t;
          float edge = cutHalf - abs(u);
          float nAA = aaWidth(edge);
          notch = 1.0 - smoothstep(0.0, nAA, edge);
        }

        float alpha = sat(side * notch);
        if (alpha <= 0.001) discard;

        gl_FragColor = vec4(u_color, alpha);
      }
    `;

    const prog = createProgram(gl, vs, fs);
    if (!prog) {
      setWebglOk(false);
      return;
    }

    setWebglOk(true);

    const aPos = gl.getAttribLocation(prog, "a_position");
    const aUv = gl.getAttribLocation(prog, "a_uv");
    const uCanvas = gl.getUniformLocation(prog, "u_canvas");
    const uColor = gl.getUniformLocation(prog, "u_color");
    const uTotalH = gl.getUniformLocation(prog, "u_totalH");
    const uTopH = gl.getUniformLocation(prog, "u_topH");
    const uTailH = gl.getUniformLocation(prog, "u_tailH");

    const posBuf = gl.createBuffer();
    const uvBuf = gl.createBuffer();
    const idxBuf = gl.createBuffer();
    if (!posBuf || !uvBuf || !idxBuf || !uCanvas || !uColor || !uTotalH || !uTopH || !uTailH) {
      setWebglOk(false);
      gl.deleteProgram(prog);
      return;
    }

    // Higher mesh resolution to reduce “sharp points”
    const COLS = 10;
    const ROWS = 32;
    const COUNT = COLS * ROWS;

    const pos = new Float32Array(COUNT * 3);
    const prev = new Float32Array(COUNT * 3);
    const rest = new Float32Array(COUNT * 3);
    const uv = new Float32Array(COUNT * 2);
    const yNorm = new Float32Array(COUNT);

    // scratch for smoothing
    const smoothTmp = new Float32Array(COUNT * 3);

    type C = { a: number; b: number; rest: number };
    const constraints: C[] = [];

    const STRIP_W = 16;
    let stripHeight = Math.max(BASE_SHAPE_HEIGHT, sizeProxyRef.current.height || BASE_SHAPE_HEIGHT);

    // Anchor (viewport space)
    let startX = 0;
    let startY = 0;

    const readAnchor = () => {
      const r = host.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      return { x: cx - STRIP_W / 2, y: r.top };
    };

    {
      const a = readAnchor();
      startX = a.x;
      startY = a.y;
    }

    const stepX = STRIP_W / (COLS - 1);
    const idx = (cx: number, ry: number) => ry * COLS + cx;

    for (let ry = 0; ry < ROWS; ry++) {
      for (let cx = 0; cx < COLS; cx++) {
        const i = idx(cx, ry);
        const x = startX + cx * stepX;
        const n = ry / (ROWS - 1);
        const y = startY + n * stripHeight;
        const z = 0;

        pos[i * 3 + 0] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;

        prev[i * 3 + 0] = x;
        prev[i * 3 + 1] = y;
        prev[i * 3 + 2] = z;

        rest[i * 3 + 0] = x;
        rest[i * 3 + 1] = y;
        rest[i * 3 + 2] = z;

        uv[i * 2 + 0] = cx / (COLS - 1);
        uv[i * 2 + 1] = n;
        yNorm[i] = n;
      }
    }

    const addConstraint = (a: number, b: number) => {
      const ax = rest[a * 3 + 0];
      const ay = rest[a * 3 + 1];
      const az = rest[a * 3 + 2];
      const bx = rest[b * 3 + 0];
      const by = rest[b * 3 + 1];
      const bz = rest[b * 3 + 2];
      const L = Math.hypot(bx - ax, by - ay, bz - az);
      constraints.push({ a, b, rest: L });
    };

    // constraints (structural + diagonals + bending)
    for (let ry = 0; ry < ROWS; ry++) {
      for (let cx = 0; cx < COLS; cx++) {
        const i = idx(cx, ry);

        if (cx + 1 < COLS) addConstraint(i, idx(cx + 1, ry));
        if (ry + 1 < ROWS) addConstraint(i, idx(cx, ry + 1));

        if (cx + 1 < COLS && ry + 1 < ROWS) addConstraint(i, idx(cx + 1, ry + 1));
        if (cx - 1 >= 0 && ry + 1 < ROWS) addConstraint(i, idx(cx - 1, ry + 1));

        if (cx + 2 < COLS) addConstraint(i, idx(cx + 2, ry));
        if (ry + 2 < ROWS) addConstraint(i, idx(cx, ry + 2));

        if (cx + 3 < COLS) addConstraint(i, idx(cx + 3, ry));
        if (ry + 3 < ROWS) addConstraint(i, idx(cx, ry + 3));
      }
    }

    const updateConstraintRest = () => {
      for (let c = 0; c < constraints.length; c++) {
        const { a, b } = constraints[c];
        const ax = rest[a * 3 + 0];
        const ay = rest[a * 3 + 1];
        const az = rest[a * 3 + 2];
        const bx = rest[b * 3 + 0];
        const by = rest[b * 3 + 1];
        const bz = rest[b * 3 + 2];
        constraints[c].rest = Math.hypot(bx - ax, by - ay, bz - az);
      }
    };

    const updateStripHeight = (nextHeight: number) => {
      const safeNext = Math.max(BASE_SHAPE_HEIGHT, nextHeight);
      if (Math.abs(safeNext - stripHeight) < 0.5) return;

      const scaleY = safeNext / stripHeight;

      for (let i = 0; i < COUNT; i++) {
        const py = pos[i * 3 + 1];
        const ppy = prev[i * 3 + 1];

        pos[i * 3 + 1] = startY + (py - startY) * scaleY;
        prev[i * 3 + 1] = startY + (ppy - startY) * scaleY;

        rest[i * 3 + 1] = startY + yNorm[i] * safeNext;
      }

      updateConstraintRest();
      stripHeight = safeNext;
    };

    // neighbors for smoothing
    const neighbors: number[][] = Array.from({ length: COUNT }, () => []);
    for (let ry = 0; ry < ROWS; ry++) {
      for (let cx = 0; cx < COLS; cx++) {
        const i = idx(cx, ry);
        const list = neighbors[i];

        if (cx - 1 >= 0) list.push(idx(cx - 1, ry));
        if (cx + 1 < COLS) list.push(idx(cx + 1, ry));
        if (ry - 1 >= 0) list.push(idx(cx, ry - 1));
        if (ry + 1 < ROWS) list.push(idx(cx, ry + 1));

        // diagonals help smooth corners
        if (cx - 1 >= 0 && ry - 1 >= 0) list.push(idx(cx - 1, ry - 1));
        if (cx + 1 < COLS && ry - 1 >= 0) list.push(idx(cx + 1, ry - 1));
        if (cx - 1 >= 0 && ry + 1 < ROWS) list.push(idx(cx - 1, ry + 1));
        if (cx + 1 < COLS && ry + 1 < ROWS) list.push(idx(cx + 1, ry + 1));
      }
    }

    const triCount = (COLS - 1) * (ROWS - 1) * 2;
    const indices = new Uint16Array(triCount * 3);

    let ti = 0;
    for (let ry = 0; ry < ROWS - 1; ry++) {
      for (let cx = 0; cx < COLS - 1; cx++) {
        const i0 = idx(cx, ry);
        const i1 = idx(cx + 1, ry);
        const i2 = idx(cx, ry + 1);
        const i3 = idx(cx + 1, ry + 1);

        indices[ti++] = i0;
        indices[ti++] = i2;
        indices[ti++] = i1;

        indices[ti++] = i1;
        indices[ti++] = i2;
        indices[ti++] = i3;
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);

    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);

    const pinned = (i: number) => Math.floor(i / COLS) === 0;

    const resetCloth = (liftPx: number) => {
      for (let i = 0; i < COUNT; i++) {
        const x = rest[i * 3 + 0];
        const y = rest[i * 3 + 1];
        const z = rest[i * 3 + 2];

        pos[i * 3 + 0] = x;
        pos[i * 3 + 2] = z;

        prev[i * 3 + 0] = x;
        prev[i * 3 + 2] = z;

        if (pinned(i)) {
          pos[i * 3 + 1] = y;
          prev[i * 3 + 1] = y;
        } else {
          const lift = liftPx * yNorm[i];
          pos[i * 3 + 1] = y + lift;
          prev[i * 3 + 1] = y + lift;

          pos[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
          prev[i * 3 + 2] = pos[i * 3 + 2];
        }
      }
    };

    simApiRef.current = { reset: resetCloth };

    if (pendingResetLiftRef.current != null) {
      resetCloth(pendingResetLiftRef.current);
      pendingResetLiftRef.current = null;
    }

    const pickNearestVertexUnpinned = (x: number, y: number) => {
      let best = -1;
      let bestD = 1e9;
      for (let i = COLS; i < COUNT; i++) {
        const px = pos[i * 3 + 0];
        const py = pos[i * 3 + 1];
        const d = (px - x) * (px - x) + (py - y) * (py - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    };

    let raf = 0;
    let lastT = 0;

    let fullW = Math.max(1, window.innerWidth);
    let fullH = Math.max(1, window.innerHeight);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      fullW = Math.max(1, window.innerWidth);
      fullH = Math.max(1, window.innerHeight);

      const w = Math.max(1, Math.round(fullW * dpr));
      const h = Math.max(1, Math.round(fullH * dpr));

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;

        // inline style prevents reload flash
        canvas.style.width = `${fullW}px`;
        canvas.style.height = `${fullH}px`;
        canvas.style.left = "0px";
        canvas.style.top = "0px";

        gl.viewport(0, 0, w, h);
      }

      gl.useProgram(prog);
      gl.uniform2f(uCanvas, fullW, fullH);
    };

    const updateAnchor = () => {
      const a = readAnchor();
      const dx = a.x - startX;
      const dy = a.y - startY;
      if (Math.abs(dx) + Math.abs(dy) < 0.01) return;

      for (let i = 0; i < COUNT; i++) {
        pos[i * 3 + 0] += dx;
        pos[i * 3 + 1] += dy;

        prev[i * 3 + 0] += dx;
        prev[i * 3 + 1] += dy;

        rest[i * 3 + 0] += dx;
        rest[i * 3 + 1] += dy;
      }

      startX = a.x;
      startY = a.y;
    };

    const enforceGrab = () => {
      const drag = dragRef.current;
      if (!ENABLE_FABRIC_DRAG) return;
      if (drag.mode !== "grab") return;
      if (drag.dragIndex < 0) return;

      const i = drag.dragIndex;
      pos[i * 3 + 0] = drag.targetX;
      pos[i * 3 + 1] = drag.targetY;
      pos[i * 3 + 2] = clamp(pos[i * 3 + 2], -18, 18);

      prev[i * 3 + 0] = drag.targetX;
      prev[i * 3 + 1] = drag.targetY;
      prev[i * 3 + 2] = pos[i * 3 + 2];
    };

    const smoothPass = (k: number) => {
      if (k <= 0) return;

      const drag = dragRef.current;
      const grabI = drag.mode === "grab" ? drag.dragIndex : -1;

      for (let i = 0; i < COUNT; i++) {
        if (pinned(i) || i === grabI) {
          smoothTmp[i * 3 + 0] = pos[i * 3 + 0];
          smoothTmp[i * 3 + 1] = pos[i * 3 + 1];
          smoothTmp[i * 3 + 2] = pos[i * 3 + 2];
          continue;
        }

        const ns = neighbors[i];
        let ax = 0,
          ay = 0,
          az = 0;
        for (let j = 0; j < ns.length; j++) {
          const n = ns[j];
          ax += pos[n * 3 + 0];
          ay += pos[n * 3 + 1];
          az += pos[n * 3 + 2];
        }
        const inv = 1 / Math.max(1, ns.length);
        ax *= inv;
        ay *= inv;
        az *= inv;

        const x = pos[i * 3 + 0];
        const y = pos[i * 3 + 1];
        const z = pos[i * 3 + 2];

        smoothTmp[i * 3 + 0] = x + (ax - x) * k;
        smoothTmp[i * 3 + 1] = y + (ay - y) * k;
        smoothTmp[i * 3 + 2] = z + (az - z) * k;
      }

      for (let i = 0; i < COUNT; i++) {
        if (pinned(i)) continue;
        pos[i * 3 + 0] = smoothTmp[i * 3 + 0];
        pos[i * 3 + 1] = smoothTmp[i * 3 + 1];
        pos[i * 3 + 2] = smoothTmp[i * 3 + 2];
      }
    };

    // initial clear to prevent any flash
    resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const draw = (time: number) => {
      if (!canvasReadyRef.current && isActive) {
        canvasReadyRef.current = true;
        setCanvasReady(true);
      }

      raf = window.requestAnimationFrame(draw);

      const dt = lastT ? clamp((time - lastT) / 1000, 0.01, 0.033) : 0.016;
      lastT = time;

      resize();
      updateAnchor();
      updateStripHeight(sizeProxyRef.current.height || BASE_SHAPE_HEIGHT);

      const extra = Math.max(0, stripHeight - BASE_SHAPE_HEIGHT);
      const topH = BASE_RECT_HEIGHT + extra;

      const drag = dragRef.current;
      const isGrab = drag.mode === "grab";
      const isReturn = drag.mode === "return";

      // Return progress
      const returnAlpha = isReturn ? clamp((time - drag.returnT0) / RETURN_MS, 0, 1) : 0;
      const returnEase = easeOutCubic(returnAlpha);

      if (isReturn && returnAlpha >= 1) {
        drag.mode = "idle";
      }

      // Physics
      const damping = 0.985;
      const gravity = 1400;

      // grabbing: very low shape pull so it can travel across the window
      // returning: ramp back up so it "falls back" naturally
      const tether = isGrab ? 2.2 : isReturn ? lerp(2.2, 22, returnEase) : 22;
      const zTether = isGrab ? 2.2 : isReturn ? lerp(2.2, 28, returnEase) : 28;

      const windStrength = 1800;
      const liftStrength = 140;

      const p = pointerRef.current;

      if (ENABLE_FABRIC_DRAG && isGrab && drag.dragIndex < 0) {
        drag.dragIndex = pickNearestVertexUnpinned(p.x, p.y);
      }

      // intro flutter (decays to 0)
      let flutter = 0;
      if (introRef.current.active) {
        const age = time - introRef.current.t0;
        flutter = clamp(1 - age / INTRO_FLUTTER_MS, 0, 1);
        if (flutter <= 0.0001) introRef.current.active = false;
      }

      // wind during show/size animations
      const anim = clamp(animWind.current.v, 0, 1);
      const velNorm = clamp(Math.abs(sizeMotionRef.current.vel) / 6, 0, 1);

      // extra “release” flutter at the start of return
      const rel = release.current.v;

      for (let i = 0; i < COUNT; i++) {
        if (pinned(i)) {
          pos[i * 3 + 0] = rest[i * 3 + 0];
          pos[i * 3 + 1] = rest[i * 3 + 1];
          pos[i * 3 + 2] = rest[i * 3 + 2];

          prev[i * 3 + 0] = rest[i * 3 + 0];
          prev[i * 3 + 1] = rest[i * 3 + 1];
          prev[i * 3 + 2] = rest[i * 3 + 2];
          continue;
        }

        // grabbed vertex hard-pins to cursor (no spikes)
        if (ENABLE_FABRIC_DRAG && isGrab && drag.dragIndex === i) {
          pos[i * 3 + 0] = drag.targetX;
          pos[i * 3 + 1] = drag.targetY;
          pos[i * 3 + 2] = -10;

          prev[i * 3 + 0] = drag.targetX;
          prev[i * 3 + 1] = drag.targetY;
          prev[i * 3 + 2] = pos[i * 3 + 2];
          continue;
        }

        const x = pos[i * 3 + 0];
        const y = pos[i * 3 + 1];
        const z = pos[i * 3 + 2];

        const px = prev[i * 3 + 0];
        const py = prev[i * 3 + 1];
        const pz = prev[i * 3 + 2];

        const vx = (x - px) * damping;
        const vy = (y - py) * damping;
        const vz = (z - pz) * damping;

        let ax = 0;
        let ay = gravity;
        let az = 0;

        // return-to-shape
        ax += (rest[i * 3 + 0] - x) * tether;
        ay += (rest[i * 3 + 1] - y) * tether;
        az += (rest[i * 3 + 2] - z) * zTether;

        const ry = Math.floor(i / COLS);
        const tRow = ry / (ROWS - 1);

        if (p.active) {
          const dx = x - p.x;
          const dy = y - p.y;
          const r2 = dx * dx + dy * dy;
          const fall = 1 / (1 + r2 / (28 * 28));

          ax += p.vx * windStrength * fall * (0.25 + 0.75 * tRow);
          ay += p.vy * windStrength * fall * (0.25 + 0.75 * tRow);
          az += -liftStrength * fall * (0.2 + 0.8 * tRow);
        }

        const tug = pull.current.v;
        if (tug > 0.0001) {
          ay += tug * 9000 * tRow;
          az += -tug * 260 * tRow;
        }

        const rev = reveal.current.v;
        if (rev > 0.0001) {
          ay += rev * REVEAL_KICK_PULL * tRow;
          az += -rev * 340 * tRow;
        }

        // intro flutter
        if (flutter > 0.0001) {
          const w = flutter * INTRO_FLUTTER_SCALE * (0.2 + 0.8 * tRow);
          ax += Math.sin(time * 0.01 + yNorm[i] * 5.5) * 2400 * w;
          az += Math.cos(time * 0.013 + yNorm[i] * 4.2) * 55 * w;
        }

        // animation wind
        const motion = Math.max(anim, velNorm * SIZE_VEL_TURBULENCE);
        if (motion > 0.0001) {
          const w = motion * (0.25 + 0.75 * tRow);
          ax += Math.sin(time * 0.012 + yNorm[i] * 6.0) * 1650 * w;
          az += Math.cos(time * 0.015 + yNorm[i] * 4.7) * 42 * w;
          ay += Math.sin(time * 0.009 + yNorm[i] * 3.3) * 620 * w;
        }

        // release “settle” (helps the return feel like a fall, not a snap)
        if (rel > 0.0001) {
          const w = rel * (0.15 + 0.85 * tRow);
          ax += Math.sin(time * 0.014 + yNorm[i] * 5.2) * 1400 * w;
          ay += Math.sin(time * 0.010 + yNorm[i] * 3.1) * 900 * w;
          az += Math.cos(time * 0.013 + yNorm[i] * 4.1) * 38 * w;
        }

        prev[i * 3 + 0] = x;
        prev[i * 3 + 1] = y;
        prev[i * 3 + 2] = z;

        pos[i * 3 + 0] = x + vx + ax * dt * dt;
        pos[i * 3 + 1] = y + vy + ay * dt * dt;
        pos[i * 3 + 2] = z + vz + az * dt * dt;
      }

      // Solve constraints more during grabbing/return to smooth kinks
      const ITER = isGrab ? 14 : isReturn ? 12 : 9;

      for (let it = 0; it < ITER; it++) {
        for (let c = 0; c < constraints.length; c++) {
          const { a, b, rest: L } = constraints[c];

          const axp = pos[a * 3 + 0];
          const ayp = pos[a * 3 + 1];
          const azp = pos[a * 3 + 2];

          const bxp = pos[b * 3 + 0];
          const byp = pos[b * 3 + 1];
          const bzp = pos[b * 3 + 2];

          const dx = bxp - axp;
          const dy = byp - ayp;
          const dz = bzp - azp;

          const d = Math.hypot(dx, dy, dz) || 1;
          const diff = (d - L) / d;

          const aPinned = pinned(a);
          const bPinned = pinned(b);

          const wa = aPinned ? 0 : 0.5;
          const wb = bPinned ? 0 : 0.5;

          const sx = dx * diff;
          const sy = dy * diff;
          const sz = dz * diff;

          if (!aPinned) {
            pos[a * 3 + 0] += sx * wa;
            pos[a * 3 + 1] += sy * wa;
            pos[a * 3 + 2] += sz * wa;
          }
          if (!bPinned) {
            pos[b * 3 + 0] -= sx * wb;
            pos[b * 3 + 1] -= sy * wb;
            pos[b * 3 + 2] -= sz * wb;
          }
        }

        // keep top row pinned
        for (let cx = 0; cx < COLS; cx++) {
          const i = idx(cx, 0);
          pos[i * 3 + 0] = rest[i * 3 + 0];
          pos[i * 3 + 1] = rest[i * 3 + 1];
          pos[i * 3 + 2] = rest[i * 3 + 2];
        }

        enforceGrab();
      }

      // Smoothing to reduce “sharp points” when dragging/returning
      const smoothK = isGrab ? 0.18 : isReturn ? lerp(0.14, 0.06, returnEase) : 0;
      smoothPass(smoothK);

      // Clamps
      if (ENABLE_FABRIC_DRAG && isGrab) {
        for (let i = 0; i < COUNT; i++) {
          if (pinned(i)) continue;
          pos[i * 3 + 0] = clamp(pos[i * 3 + 0], -VIEWPORT_PAD, fullW + VIEWPORT_PAD);
          pos[i * 3 + 1] = clamp(pos[i * 3 + 1], -VIEWPORT_PAD, fullH + VIEWPORT_PAD);
          pos[i * 3 + 2] = clamp(pos[i * 3 + 2], -18, 18);
        }
      } else if (isReturn) {
        const minX = lerp(-VIEWPORT_PAD, 0, returnEase);
        const maxX = lerp(fullW + VIEWPORT_PAD, fullW, returnEase);
        const minY = lerp(-VIEWPORT_PAD, startY - 8, returnEase);
        const maxY = lerp(fullH + VIEWPORT_PAD, startY + stripHeight + 14, returnEase);

        for (let i = 0; i < COUNT; i++) {
          if (pinned(i)) continue;
          pos[i * 3 + 0] = clamp(pos[i * 3 + 0], minX, maxX);
          pos[i * 3 + 1] = clamp(pos[i * 3 + 1], minY, maxY);
          pos[i * 3 + 2] = clamp(pos[i * 3 + 2], -18, 18);
        }
      } else {
        for (let i = 0; i < COUNT; i++) {
          if (pinned(i)) continue;
          pos[i * 3 + 0] = clamp(pos[i * 3 + 0], startX - 10, startX + STRIP_W + 10);
          pos[i * 3 + 1] = clamp(pos[i * 3 + 1], startY - 8, startY + stripHeight + 14);
          pos[i * 3 + 2] = clamp(pos[i * 3 + 2], -18, 18);
        }
      }

      enforceGrab();

      // draw
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(prog);
      gl.uniform3f(uColor, RED_500.r, RED_500.g, RED_500.b);
      gl.uniform1f(uTotalH, stripHeight);
      gl.uniform1f(uTopH, topH);
      gl.uniform1f(uTailH, TAIL_HEIGHT);

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.enableVertexAttribArray(aUv);
      gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    };

    raf = window.requestAnimationFrame(draw);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      isActive = false;
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);

      simApiRef.current = null;

      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(uvBuf);
      gl.deleteBuffer(idxBuf);
      gl.deleteProgram(prog);
    };
  }, [overlayEl]);

  const fallbackBookmark = useMemo(() => {
    return (
      <div
        className="relative flex w-12 items-start justify-center pointer-events-none"
        style={{ height: `calc(${BASE_SHAPE_HEIGHT}px + var(--bookmark-extra, 0px))` }}
      >
        <div className="flex flex-col items-center">
          <span
            className="block w-4 bg-red-500 transition-[height] duration-300 ease-out"
            style={{ height: `calc(${BASE_RECT_HEIGHT}px + var(--bookmark-extra, 0px))` }}
          />
          <span
            aria-hidden
            className="block w-4 h-[40px] bg-red-500 [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]"
          />
        </div>
      </div>
    );
  }, []);

  const ariaLabel = isHome ? homeLabel ?? "Project index" : "Back";
  const fallbackVisible = !webglOk || !canvasReady;
  const canvasVisible = webglOk && canvasReady;

  return (
    <>
      {/* Canvas is portaled to document.body (prevents clipping + fixes left-edge limits caused by transformed ancestors) */}
      {overlayEl && webglOk
        ? createPortal(
          <canvas
            ref={canvasRef}
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: "transparent",
              opacity: canvasVisible ? 1 : 0,
              transition: "opacity 150ms ease",
              display: "block",
            }}
          />,
          overlayEl
        )
        : null}

      <a
        ref={linkRef}
        href={href}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onClick={onClick}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        aria-label={ariaLabel}
        aria-controls={isHome ? ariaControls : undefined}
        aria-expanded={isHome ? ariaExpanded : undefined}
        style={{ touchAction: "none" }}
        className={cn(
          "group fixed top-0 z-[10010] overflow-visible origin-top",
          side === "left" ? "left-6" : "right-6",
          "inline-flex items-start justify-center",
          "h-[92px] w-12",
          "opacity-0",
          "select-none [-webkit-user-drag:none]",
          ENABLE_FABRIC_DRAG ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          className
        )}
      >
        <div ref={innerWrapRef} className="relative h-full w-full pointer-events-none">
          <div
            ref={clothHostRef}
            className="absolute left-1/2 top-0 w-12 -translate-x-1/2 pointer-events-none"
            style={{ height: "var(--bookmark-total, 64px)" }}
          >
            <div
              className={cn(
                "absolute inset-0 transition-opacity duration-150",
                fallbackVisible ? "opacity-100" : "opacity-0"
              )}
            >
              {fallbackBookmark}
            </div>
          </div>
        </div>
      </a>
    </>
  );
}
