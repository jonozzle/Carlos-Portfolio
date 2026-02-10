// components/header/bookmark-link-fabric.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
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

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function isDesktopSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const vendor = navigator.vendor || "";
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
  const isApple = /Apple/i.test(vendor);
  const isMobile = /Mobile|iP(ad|hone|od)/i.test(ua);
  return isSafari && isApple && !isMobile;
}

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
const DRAWER_SYNC_DUR = 1.1;
const FIRST_DROP_DUR = 0.45;
const DRAWER_SYNC_EASE = "elastic.out(1,0.5)";

// Intro “fabric fall”
const REVEAL_LIFT_PX = -90;
const REVEAL_KICK_PULL = 14000;
const INTRO_FLUTTER_MS = 1200;
const INTRO_FLUTTER_SCALE = 0.1;

// “fabric-ness” during size/visibility animations
const ANIM_WIND_MS = 420;
const SIZE_WIND_KICK = 0.02;
const SIZE_VEL_TURBULENCE = 0.003;

// Height overshoot when shrinking back to home
const SIZE_BOUNCE_MIN_PX = 12;
const SIZE_BOUNCE_MAX_PX = 64;
const SIZE_BOUNCE_RATIO = 0.06;

// Grab behavior
const GRAB_HOLD_MS = 90;
const GRAB_MOVE_PX = 2;

// Return behavior (release should “fall back” instead of snapping)
const RETURN_MS = 950;
const RETURN_SETTLE_DIST = 6;

// Viewport clamp padding (lets you pull slightly off-screen)
const VIEWPORT_PAD = 140;
const RETURN_PAD = VIEWPORT_PAD * 2;
const RETURN_PAD_X = VIEWPORT_PAD * 10;

// Scroll wind (horizontal breeze during scroll)
const SCROLL_WIND_STRENGTH = 950;
const SCROLL_WIND_NORM = 1200;
const SCROLL_WIND_MAX = 1.2;
const SCROLL_WIND_SMOOTH = 0.12;
const SAFARI_SCROLL_WIND_MULT = 0.7;
const SAFARI_SCROLL_WIND_SMOOTH = 0.14;
const SAFARI_DAMPING_SCROLLING = 0.82;
const SAFARI_DAMPING_IDLE = 0.8;
const SAFARI_WIND_MULT = 0.6;
const SAFARI_LIFT_MULT = 0.6;
const SAFARI_FLUTTER_MULT = 0.0;
const SAFARI_RELEASE_MULT = 0.12;
const SAFARI_ANIM_MULT = 0.3;
const SAFARI_GRAVITY = 1050;
const SAFARI_TETHER_MULT = 1.25;
const SAFARI_Z_TETHER_MULT = 1.1;
const SAFARI_GRAB_STRETCH = 1.3;
const SAFARI_GRAB_REST_MIN = 0.05;
const SAFARI_GRAB_TETHER_MULT = 0.45;
const SAFARI_GRAB_Z_TETHER_MULT = 0.5;

const SETTLE_SPEED = 6;
const SETTLE_HOLD_MS = 180;
const SIZE_EPS = 2;
const SIZE_TWEEN_DUR = 0.7;
const VIEWPORT_HEIGHT_EPS = 8;

// Grab smoothing (softly pull a patch to avoid vertex points)
const GRAB_SOFT_RADIUS = 3;
const GRAB_SOFT_STRENGTH = 0.8;
const GRAB_MAX_STRETCH = 1.02;
const GRAB_OVERDRAG = 0.05;

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

function readViewportHeight(): number {
  if (typeof window === "undefined") return 0;
  const vv = window.visualViewport;
  const h = vv && typeof vv.height === "number" ? vv.height : window.innerHeight;
  return Number.isFinite(h) ? h : window.innerHeight || 0;
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

function isTransitionBusy() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (isHeroOverlayBusy()) return true;
  if ((window as any).__pageTransitionPending) return true;
  if ((window as any).__pageTransitionBusy) return true;
  if ((document.documentElement as any).dataset?.pageTransitionBusy === "1") return true;
  if ((document.documentElement as any).dataset?.homeHold === "1") return true;
  return false;
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
  const safariDesktop = useMemo(() => isDesktopSafari(), []);

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
  const sizeTweenRef = useRef<gsap.core.Animation | null>(null);
  const pendingSizeRef = useRef<StoredSize | null>(null);
  const deferSizeRafRef = useRef<number | null>(null);
  const safariFreezeSizeRef = useRef(false);

  const sizeMotionRef = useRef({
    lastH: stored0?.height ?? 0,
    vel: 0,
  });
  const viewportHeightRef = useRef(0);
  const pendingViewportHeightRef = useRef<number | null>(null);
  const scrollActiveRef = useRef(false);

  const [webglOk, setWebglOk] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [isShown, setIsShown] = useState(false);
  const [prewarm, setPrewarm] = useState(false);
  const canvasReadyRef = useRef(false);
  const isShownRef = useRef(isShown);

  const debugStateRef = useRef({
    targetH: 0,
    targetExtra: 0,
    appliedH: 0,
    appliedExtra: 0,
    lastApplyAt: 0,
    anchorX: 0,
    anchorY: 0,
    stripH: 0,
    scrollVx: 0,
    lastWindAt: 0,
  });

  const pull = useRef({ v: 0 });
  const lastTugAtRef = useRef(0);

  const reveal = useRef({ v: 0 });
  const introRef = useRef<{ t0: number; active: boolean }>({ t0: 0, active: false });

  const release = useRef({ v: 0 }); // helps the “fall back” feel on release

  const animWind = useRef({ v: 0 });
  const animWindTweenRef = useRef<gsap.core.Animation | null>(null);

  useEffect(() => {
    isShownRef.current = isShown;
  }, [isShown]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStart = () => setTransitionBusy((prev) => (prev ? prev : true));
    const onEnd = () => setTransitionBusy((prev) => (prev ? false : prev));

    window.addEventListener(APP_EVENTS.NAV_START, onStart);
    window.addEventListener(APP_EVENTS.NAV_END, onEnd);

    return () => {
      window.removeEventListener(APP_EVENTS.NAV_START, onStart);
      window.removeEventListener(APP_EVENTS.NAV_END, onEnd);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (deferSizeRafRef.current != null) {
        window.cancelAnimationFrame(deferSizeRafRef.current);
        deferSizeRafRef.current = null;
      }
    };
  }, []);

  const simApiRef = useRef<
    { reset: (liftPx: number, opts?: { randomizeZ?: boolean }) => void } | null
  >(null);
  const pendingResetLiftRef = useRef<{ lift: number; randomizeZ?: boolean } | null>(null);
  const showDelayRef = useRef<number | null>(null);
  const dropTimerRef = useRef<number | null>(null);
  const dropActiveRef = useRef(false);

  const dragRef = useRef({
    down: false,
    moved: false,
    startX: 0,
    startY: 0,
    downAt: 0,
    suppressClick: false,
    pointerId: -1,
    useWindowPointer: false,
    dragIndex: -1,
    grabRow: -1,
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

  const windowPointerHandlersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    cancel: (e: PointerEvent) => void;
  } | null>(null);

  const scrollWindRef = useRef({
    vx: 0,
    lastT: 0,
    lastProgress: 0,
    lastX: 0,
    lastMoveT: 0,
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
  }, [prewarm]);

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
    const dhSafe = Math.abs(dh) < 1 ? 0 : dh;
    sizeMotionRef.current.lastH = height;
    sizeMotionRef.current.vel = sizeMotionRef.current.vel * 0.75 + dhSafe * 0.25;

    gsap.set(el, { height });
    el.style.setProperty("--bookmark-total", `${height}px`);
    el.style.setProperty("--bookmark-extra", `${extra}px`);

    setStoredSize({ height, extra });

    debugStateRef.current.appliedH = height;
    debugStateRef.current.appliedExtra = extra;
    debugStateRef.current.lastApplyAt = performance.now();
  }, []);

  const computeTargetSize = useCallback(() => {
    if (typeof window === "undefined") {
      const h = HOME_ANCHOR_HEIGHT;
      return { height: h, extra: Math.max(0, h - BASE_SHAPE_HEIGHT) };
    }
    const viewportH = viewportHeightRef.current || readViewportHeight();
    const rawHeight = isHome ? HOME_ANCHOR_HEIGHT : viewportH * BOOKMARK_TALL_VH;
    const targetHeight = Math.round(rawHeight / SIZE_EPS) * SIZE_EPS;
    const targetExtra = Math.max(0, targetHeight - BASE_SHAPE_HEIGHT);
    return { height: targetHeight, extra: targetExtra };
  }, [isHome]);

  const tweenSizeTo = useCallback(
    (height: number, extra: number, duration = SIZE_TWEEN_DUR) => {
      sizeTweenRef.current?.kill();
      const proxy = sizeProxyRef.current;
      sizeTweenRef.current = gsap.to(proxy, {
        height,
        extra,
        duration,
        ease: "power2.out",
        overwrite: "auto",
        onUpdate: () => applySize(proxy.height, proxy.extra),
      });
    },
    [applySize]
  );

  const animateToTargetSize = useCallback(() => {
    const { height, extra } = computeTargetSize();
    tweenSizeTo(height, extra, SIZE_TWEEN_DUR);
  }, [computeTargetSize, tweenSizeTo]);

  const flushPendingSize = useCallback(
    (opts?: { force?: boolean; animate?: boolean }) => {
      if (!pendingSizeRef.current) return;
      if (!opts?.force && isTransitionBusy()) return;
      const { height, extra } = pendingSizeRef.current;
      pendingSizeRef.current = null;
      if (opts?.animate) {
        tweenSizeTo(height, extra, SIZE_TWEEN_DUR);
        return;
      }
      applySize(height, extra);
    },
    [applySize, tweenSizeTo]
  );

  const scheduleDeferredSize = useCallback(() => {
    if (typeof window === "undefined") return;
    if (deferSizeRafRef.current != null) return;

    const tick = () => {
      deferSizeRafRef.current = null;
      if (!pendingSizeRef.current) return;
      if (isTransitionBusy()) {
        deferSizeRafRef.current = window.requestAnimationFrame(tick);
        return;
      }
      flushPendingSize({ animate: true });
    };

    deferSizeRafRef.current = window.requestAnimationFrame(tick);
  }, [flushPendingSize]);

  useEffect(() => {
    if (!safariDesktop) return;
    if (transitionBusy) {
      safariFreezeSizeRef.current = true;
      pendingSizeRef.current = null;
      sizeTweenRef.current?.kill();
      return;
    }
    if (safariFreezeSizeRef.current) {
      safariFreezeSizeRef.current = false;
      animateToTargetSize();
    }
  }, [animateToTargetSize, safariDesktop, transitionBusy]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onNavEnd = () => flushPendingSize({ force: true, animate: true });
    const onHomeRestored = () => flushPendingSize({ force: true, animate: true });

    window.addEventListener(APP_EVENTS.NAV_END, onNavEnd);
    window.addEventListener(APP_EVENTS.HOME_HS_RESTORED, onHomeRestored);

    return () => {
      window.removeEventListener(APP_EVENTS.NAV_END, onNavEnd);
      window.removeEventListener(APP_EVENTS.HOME_HS_RESTORED, onHomeRestored);
    };
  }, [flushPendingSize]);

  const updateSize = useCallback(
    (immediate?: boolean) => {
      const { height: targetHeight, extra: targetExtra } = computeTargetSize();

      sizeTweenRef.current?.kill();

      debugStateRef.current.targetH = targetHeight;
      debugStateRef.current.targetExtra = targetExtra;

      const proxy = sizeProxyRef.current;
      const heightDiff = Math.abs(targetHeight - proxy.height);
      const extraDiff = Math.abs(targetExtra - proxy.extra);
      if (heightDiff < SIZE_EPS && extraDiff < SIZE_EPS) return;

      if (safariDesktop && safariFreezeSizeRef.current) {
        return;
      }

      const busy = transitionBusy || isTransitionBusy();
      if (busy) {
        sizeTweenRef.current?.kill();
        pendingSizeRef.current = { height: targetHeight, extra: targetExtra };
        scheduleDeferredSize();
        return;
      }

      if (safariDesktop) {
        // Always tween on Safari for smooth height changes
        tweenSizeTo(targetHeight, targetExtra, SIZE_TWEEN_DUR);
        return;
      }

      if (immediate) {
        applySize(targetHeight, targetExtra);
        return;
      }

      const currentHeight =
        Number.isFinite(proxy.height) && proxy.height > 0 ? proxy.height : targetHeight;
      const shouldBounceToHome = isHome && targetHeight < currentHeight - 0.5;

      kickAnimWind(SIZE_WIND_KICK);

      if (shouldBounceToHome) {
        const bump = clamp(currentHeight * SIZE_BOUNCE_RATIO, SIZE_BOUNCE_MIN_PX, SIZE_BOUNCE_MAX_PX);
        const peak = currentHeight + bump;
        const peakExtra = Math.max(0, peak - BASE_SHAPE_HEIGHT);

        const timeline = gsap.timeline({
          defaults: { overwrite: "auto" },
          onUpdate: () => applySize(proxy.height, proxy.extra),
        });

        timeline
          .to(proxy, { height: peak, extra: peakExtra, duration: 0.22, ease: "power2.out" })
          .to(proxy, { height: targetHeight, extra: targetExtra, duration: 0.75, ease: "power2.out" });

        sizeTweenRef.current = timeline;
        return;
      }

      sizeTweenRef.current = gsap.to(proxy, {
        height: targetHeight,
        extra: targetExtra,
        duration: 0.7,
        ease: "power2.out",
        overwrite: "auto",
        onUpdate: () => applySize(proxy.height, proxy.extra),
      });
    },
    [
      applySize,
      computeTargetSize,
      isHome,
      kickAnimWind,
      safariDesktop,
      scheduleDeferredSize,
      transitionBusy,
    ]
  );

  useEffect(() => {
    if (!shownRef.current) return;
    updateSize(false);
  }, [isHome, updateSize]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    viewportHeightRef.current = readViewportHeight();

    const commitHeight = (next: number) => {
      const prev = viewportHeightRef.current || next;
      if (Math.abs(next - prev) < VIEWPORT_HEIGHT_EPS) return;
      viewportHeightRef.current = next;
      if (transitionBusy || isTransitionBusy()) {
        pendingViewportHeightRef.current = next;
        pendingSizeRef.current = computeTargetSize();
        scheduleDeferredSize();
        return;
      }
      updateSize(true);
    };

    const onResize = () => {
      const next = readViewportHeight();
      if (scrollActiveRef.current || transitionBusy || isTransitionBusy()) {
        pendingViewportHeightRef.current = next;
        return;
      }
      commitHeight(next);
    };

    const onScrollStart = () => {
      scrollActiveRef.current = true;
    };
    const onScrollEnd = () => {
      scrollActiveRef.current = false;
      if (pendingViewportHeightRef.current == null) return;
      const next = pendingViewportHeightRef.current;
      pendingViewportHeightRef.current = null;
      commitHeight(next);
    };

    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.addEventListener(APP_EVENTS.SCROLL_START, onScrollStart);
    window.addEventListener(APP_EVENTS.SCROLL_END, onScrollEnd);

    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener(APP_EVENTS.SCROLL_START, onScrollStart);
      window.removeEventListener(APP_EVENTS.SCROLL_END, onScrollEnd);
    };
  }, [computeTargetSize, scheduleDeferredSize, transitionBusy, updateSize]);

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

    if (showDelayRef.current) {
      window.clearTimeout(showDelayRef.current);
      showDelayRef.current = null;
    }
    if (prewarm) setPrewarm(false);
    if (dropTimerRef.current) {
      window.clearTimeout(dropTimerRef.current);
      dropTimerRef.current = null;
    }
    dropActiveRef.current = false;

    shownRef.current = false;
    setIsShown(false);

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
    setIsShown(true);
    if (prewarm) setPrewarm(false);
    const shouldPlainDrop = isHome && !wasShown;

    updateSize(false);

    gsap.killTweensOf(el, "autoAlpha");
    gsap.set(el, { pointerEvents: "auto" });
    gsap.to(el, { autoAlpha: 1, duration: 0.15, ease: "power2.out", overwrite: "auto" });

    if (!wasShown) {
      gsap.killTweensOf(inner, "y");
      gsap.set(inner, { y: DROP_INNER_Y });
      const dropDur = shouldPlainDrop ? FIRST_DROP_DUR : DRAWER_SYNC_DUR;
      const dropEase = shouldPlainDrop ? "none" : DRAWER_SYNC_EASE;
      gsap.to(inner, { y: 0, duration: dropDur, ease: dropEase, overwrite: "auto" });

      const scheduleReveal = (
        liftPx: number,
        opts?: { randomizeZ?: boolean; silent?: boolean }
      ) => {
        if (simApiRef.current) simApiRef.current.reset(liftPx, { randomizeZ: opts?.randomizeZ });
        else pendingResetLiftRef.current = { lift: liftPx, randomizeZ: opts?.randomizeZ };

        if (!opts?.silent) {
          kickReveal();
          kickAnimWind(1);
        }
      };

      if (safariDesktop) {
        scheduleReveal(REVEAL_LIFT_PX * 0.25, { randomizeZ: false });
        dropActiveRef.current = true;
        if (dropTimerRef.current) window.clearTimeout(dropTimerRef.current);
        dropTimerRef.current = window.setTimeout(() => {
          dropTimerRef.current = null;
          dropActiveRef.current = false;
          if (!isShownRef.current) return;
        }, Math.round(dropDur * 1000) + 80);
      } else {
        scheduleReveal(REVEAL_LIFT_PX);
      }
    }
  }, [isHome, kickAnimWind, kickReveal, prewarm, safariDesktop, updateSize]);

  const showWithPrewarm = useCallback(() => {
    if (!safariDesktop) {
      show();
      return;
    }

    if (!simApiRef.current || !canvasReadyRef.current) {
      setPrewarm(true);
      if (showDelayRef.current) window.clearTimeout(showDelayRef.current);
      showDelayRef.current = window.setTimeout(() => {
        showDelayRef.current = null;
        show();
      }, 120);
      return;
    }

    show();
  }, [safariDesktop, show]);

  // Follow drawer
  const followActive = !!(isHome && homeFollow && homeFollowRef?.current && !transitionBusy);

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
          setY(Math.round(rect.bottom - ancTop));
        }
        raf = window.requestAnimationFrame(tick);
      };

      tick();
      return () => window.cancelAnimationFrame(raf);
    }

    window.cancelAnimationFrame(raf);
    gsap.killTweensOf(el, "y");
    gsap.to(el, { y: 0, duration: 0.55, ease: "bounce.out", overwrite: "auto" });

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
        const shouldTug = !!href && href !== "/";
        if (shouldTug && now - lastTugAtRef.current > TUG_COOLDOWN_MS) {
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
    [doNavigate, href, isHome, onHomeToggle]
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

    const onShow = () => showWithPrewarm();
    const onHide = () => hide();

    window.addEventListener(APP_EVENTS.UI_BOOKMARK_SHOW, onShow);
    window.addEventListener(APP_EVENTS.UI_BOOKMARK_HIDE, onHide);

    if (loaderDone) showWithPrewarm();
    else hide(true);

    return () => {
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_SHOW, onShow);
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_HIDE, onHide);
    };
  }, [applySize, computeTargetSize, hide, showWithPrewarm, loaderDone]);

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

  const handleDragMove = useCallback(
    (pointerId: number) => {
      if (!ENABLE_FABRIC_DRAG) return;
      const drag = dragRef.current;
      if (!drag.down) return;
      if (drag.pointerId !== -1 && pointerId !== drag.pointerId) return;

      const now = performance.now();
      const dx = drag.targetX - drag.startX;
      const dy = drag.targetY - drag.startY;
      const dist = Math.hypot(dx, dy);

      if (!drag.moved && dist > GRAB_MOVE_PX) {
        drag.moved = true;
      }

      if (drag.mode !== "grab") {
        const holdMs = safariDesktop ? 0 : GRAB_HOLD_MS;
        const heldLongEnough = now - drag.downAt >= holdMs;
        if (heldLongEnough && drag.moved) {
          drag.mode = "grab";
          drag.suppressClick = true;
        }
      }
    },
    [safariDesktop]
  );

  const detachWindowPointerListeners = useCallback(() => {
    if (typeof window === "undefined") return;
    const handlers = windowPointerHandlersRef.current;
    if (!handlers) return;
    window.removeEventListener("pointermove", handlers.move);
    window.removeEventListener("pointerup", handlers.up);
    window.removeEventListener("pointercancel", handlers.cancel);
    windowPointerHandlersRef.current = null;
    dragRef.current.useWindowPointer = false;
  }, []);

  type PointerLikeEvent = { clientX: number; clientY: number; pointerId: number };

  const endPointer = useCallback(
    (e: PointerLikeEvent) => {
      const drag = dragRef.current;
      if (drag.pointerId !== -1 && e.pointerId !== drag.pointerId) return;

      const wasDown = drag.down;
      const wasGrab = drag.mode === "grab";

      drag.down = false;
      drag.pointerId = -1;
      drag.dragIndex = -1;
      drag.grabRow = -1;
      drag.useWindowPointer = false;

      if (wasGrab) {
        drag.mode = "return";
        drag.returnT0 = performance.now();
        kickRelease();
        kickAnimWind(0.9);
      } else {
        drag.mode = drag.mode === "grab" ? "idle" : drag.mode;
      }

      if (wasDown && !pointInAnchor(e.clientX, e.clientY)) {
        pointerRef.current.active = false;
        pointerRef.current.vx *= 0.25;
        pointerRef.current.vy *= 0.25;
      }

      if (drag.suppressClick) {
        window.setTimeout(() => {
          drag.suppressClick = false;
        }, 0);
      }

      try {
        linkRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      detachWindowPointerListeners();
    },
    [detachWindowPointerListeners, kickAnimWind, kickRelease, pointInAnchor]
  );

  const attachWindowPointerListeners = useCallback(() => {
    if (typeof window === "undefined") return;
    if (windowPointerHandlersRef.current) return;

    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.down || !drag.useWindowPointer) return;
      if (drag.pointerId !== -1 && e.pointerId !== drag.pointerId) return;
      updatePointer(e.clientX, e.clientY);
      handleDragMove(e.pointerId);
    };

    const up = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.down || !drag.useWindowPointer) return;
      if (drag.pointerId !== -1 && e.pointerId !== drag.pointerId) return;
      endPointer({ clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId });
    };

    const cancel = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.down || !drag.useWindowPointer) return;
      if (drag.pointerId !== -1 && e.pointerId !== drag.pointerId) return;
      endPointer({ clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId });
    };

    windowPointerHandlersRef.current = { move, up, cancel };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("pointercancel", cancel, { passive: true });
    dragRef.current.useWindowPointer = true;
  }, [endPointer, handleDragMove, updatePointer]);

  useEffect(() => {
    return () => {
      detachWindowPointerListeners();
    };
  }, [detachWindowPointerListeners]);

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
      dragRef.current.grabRow = -1;
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
      dragRef.current.downAt = performance.now();
      dragRef.current.pointerId = e.pointerId;
      dragRef.current.useWindowPointer = false;

      // don’t kill return instantly; only if they start a new grab
      if (dragRef.current.mode === "return") dragRef.current.mode = "idle";

      let needsWindowPointer = safariDesktop;
      if (!needsWindowPointer) {
        if (typeof a.setPointerCapture === "function") {
          try {
            a.setPointerCapture(e.pointerId);
          } catch {
            needsWindowPointer = true;
          }
          if (
            !needsWindowPointer &&
            typeof a.hasPointerCapture === "function" &&
            !a.hasPointerCapture(e.pointerId)
          ) {
            needsWindowPointer = true;
          }
        } else {
          needsWindowPointer = true;
        }
      }

      if (needsWindowPointer) {
        attachWindowPointerListeners();
      }
    },
    [attachWindowPointerListeners, safariDesktop, updatePointer]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      updatePointer(e.clientX, e.clientY);
      handleDragMove(e.pointerId);
    },
    [handleDragMove, updatePointer]
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

  const simEnabled = loaderDone && (isShown || prewarm);

  // WebGL cloth
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!simEnabled) {
      canvasReadyRef.current = false;
      setCanvasReady(false);
      return;
    }

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
    const COLS = safariDesktop ? 8 : 10;
    const ROWS = safariDesktop ? 24 : 32;
    const COUNT = COLS * ROWS;

    const pos = new Float32Array(COUNT * 3);
    const prev = new Float32Array(COUNT * 3);
    const rest = new Float32Array(COUNT * 3);
    const rowPos = new Float32Array(ROWS * 3);
    const rowPrev = new Float32Array(ROWS * 3);
    const uv = new Float32Array(COUNT * 2);
    const yNorm = new Float32Array(COUNT);
    const rowNorm = new Float32Array(ROWS);
    const rowT = new Float32Array(ROWS);

    // scratch for smoothing
    const smoothTmp = new Float32Array(COUNT * 3);
    const rowFlutterAx = new Float32Array(ROWS);
    const rowFlutterAz = new Float32Array(ROWS);
    const rowAnimAx = new Float32Array(ROWS);
    const rowAnimAy = new Float32Array(ROWS);
    const rowAnimAz = new Float32Array(ROWS);
    const rowReleaseAx = new Float32Array(ROWS);
    const rowReleaseAy = new Float32Array(ROWS);
    const rowReleaseAz = new Float32Array(ROWS);

    type C = { a: number; b: number; rest: number };
    const constraintsBase: C[] = [];
    const constraintsExtra: C[] = [];

    const STRIP_W = 16;
    let stripHeight = Math.max(BASE_SHAPE_HEIGHT, sizeProxyRef.current.height || BASE_SHAPE_HEIGHT);

    // Anchor (viewport space)
    let startX = 0;
    let startY = 0;

    const readAnchor = () => {
      const r = host.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const next = {
        x: Math.round(cx - STRIP_W / 2),
        y: Math.round(r.top),
      };
      debugStateRef.current.anchorX = next.x;
      debugStateRef.current.anchorY = next.y;
      return next;
    };

    {
      const a = readAnchor();
      startX = a.x;
      startY = a.y;
    }

    const stepX = STRIP_W / (COLS - 1);
    const centerCol = Math.floor(COLS / 2);
    const idx = (cx: number, ry: number) => ry * COLS + cx;

    for (let ry = 0; ry < ROWS; ry++) {
      const n = ry / (ROWS - 1);
      rowNorm[ry] = n;
      rowT[ry] = n;
      for (let cx = 0; cx < COLS; cx++) {
        const i = idx(cx, ry);
        const x = startX + cx * stepX;
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

    for (let ry = 0; ry < ROWS; ry++) {
      const i = idx(centerCol, ry);
      rowPos[ry * 3 + 0] = rest[i * 3 + 0];
      rowPos[ry * 3 + 1] = rest[i * 3 + 1];
      rowPos[ry * 3 + 2] = rest[i * 3 + 2];

      rowPrev[ry * 3 + 0] = rest[i * 3 + 0];
      rowPrev[ry * 3 + 1] = rest[i * 3 + 1];
      rowPrev[ry * 3 + 2] = rest[i * 3 + 2];
    }

    const addConstraint = (list: C[], a: number, b: number) => {
      const ax = rest[a * 3 + 0];
      const ay = rest[a * 3 + 1];
      const az = rest[a * 3 + 2];
      const bx = rest[b * 3 + 0];
      const by = rest[b * 3 + 1];
      const bz = rest[b * 3 + 2];
      const L = Math.hypot(bx - ax, by - ay, bz - az);
      list.push({ a, b, rest: L });
    };

    // constraints (structural + diagonals + bending)
    for (let ry = 0; ry < ROWS; ry++) {
      for (let cx = 0; cx < COLS; cx++) {
        const i = idx(cx, ry);

        if (cx + 1 < COLS) addConstraint(constraintsBase, i, idx(cx + 1, ry));
        if (ry + 1 < ROWS) addConstraint(constraintsBase, i, idx(cx, ry + 1));

        if (cx + 1 < COLS && ry + 1 < ROWS)
          addConstraint(constraintsBase, i, idx(cx + 1, ry + 1));
        if (cx - 1 >= 0 && ry + 1 < ROWS)
          addConstraint(constraintsBase, i, idx(cx - 1, ry + 1));

        if (cx + 2 < COLS) addConstraint(constraintsExtra, i, idx(cx + 2, ry));
        if (ry + 2 < ROWS) addConstraint(constraintsExtra, i, idx(cx, ry + 2));

        if (!safariDesktop && cx + 3 < COLS) addConstraint(constraintsExtra, i, idx(cx + 3, ry));
        if (!safariDesktop && ry + 3 < ROWS) addConstraint(constraintsExtra, i, idx(cx, ry + 3));
      }
    }

    const constraintsAll = constraintsBase.concat(constraintsExtra);

    const updateConstraintRest = () => {
      for (let c = 0; c < constraintsAll.length; c++) {
        const { a, b } = constraintsAll[c];
        const ax = rest[a * 3 + 0];
        const ay = rest[a * 3 + 1];
        const az = rest[a * 3 + 2];
        const bx = rest[b * 3 + 0];
        const by = rest[b * 3 + 1];
        const bz = rest[b * 3 + 2];
        constraintsAll[c].rest = Math.hypot(bx - ax, by - ay, bz - az);
      }
    };

    const updateStripHeight = (nextHeight: number) => {
      const safeNext = Math.max(BASE_SHAPE_HEIGHT, nextHeight);
      if (Math.abs(safeNext - stripHeight) < SIZE_EPS) return;

      const scaleY = safeNext / stripHeight;

      for (let i = 0; i < COUNT; i++) {
        const py = pos[i * 3 + 1];
        const ppy = prev[i * 3 + 1];

        pos[i * 3 + 1] = startY + (py - startY) * scaleY;
        prev[i * 3 + 1] = startY + (ppy - startY) * scaleY;

        rest[i * 3 + 1] = startY + yNorm[i] * safeNext;
      }

      for (let ry = 0; ry < ROWS; ry++) {
        const i = ry * 3;
        const py = rowPos[i + 1];
        const ppy = rowPrev[i + 1];
        rowPos[i + 1] = startY + (py - startY) * scaleY;
        rowPrev[i + 1] = startY + (ppy - startY) * scaleY;
      }

      updateConstraintRest();
      stripHeight = safeNext;
      debugStateRef.current.stripH = stripHeight;
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

    const resetCloth = (liftPx: number, opts?: { randomizeZ?: boolean }) => {
      const randomizeZ = opts?.randomizeZ ?? true;
      for (let i = 0; i < COUNT; i++) {
        const x = rest[i * 3 + 0];
        const y = rest[i * 3 + 1];
        const z = rest[i * 3 + 2];

        pos[i * 3 + 0] = x;
        prev[i * 3 + 0] = x;

        if (pinned(i)) {
          pos[i * 3 + 1] = y;
          prev[i * 3 + 1] = y;
          pos[i * 3 + 2] = z;
          prev[i * 3 + 2] = z;
        } else {
          const lift = liftPx * yNorm[i];
          pos[i * 3 + 1] = y + lift;
          prev[i * 3 + 1] = y + lift;

          const newZ = randomizeZ ? (Math.random() - 0.5) * 2.5 : z;
          pos[i * 3 + 2] = newZ;
          prev[i * 3 + 2] = newZ;
        }
      }

      for (let ry = 0; ry < ROWS; ry++) {
        const i = idx(centerCol, ry);
        const x = rest[i * 3 + 0];
        const y = rest[i * 3 + 1];
        const z = rest[i * 3 + 2];
        const lift = ry === 0 ? 0 : liftPx * rowT[ry];
        const newZ = randomizeZ ? (Math.random() - 0.5) * 2.5 : z;

        const ii = ry * 3;
        rowPos[ii + 0] = x;
        rowPos[ii + 1] = y + lift;
        rowPos[ii + 2] = ry === 0 ? z : newZ;

        rowPrev[ii + 0] = x;
        rowPrev[ii + 1] = y + lift;
        rowPrev[ii + 2] = ry === 0 ? z : newZ;
      }
    };

    simApiRef.current = { reset: resetCloth };

    if (pendingResetLiftRef.current != null) {
      resetCloth(pendingResetLiftRef.current.lift, {
        randomizeZ: pendingResetLiftRef.current.randomizeZ,
      });
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
    let timeoutId: number | null = null;
    let lastT = 0;
    let lastActiveAt = 0;
    let debugEl: HTMLDivElement | null = null;
    let debugNextAt = 0;

    let fullW = Math.max(1, window.innerWidth);
    let fullH = Math.max(1, window.innerHeight);

    const scrollWind = scrollWindRef.current;
    scrollWind.vx = 0;
    scrollWind.lastT = 0;
    scrollWind.lastProgress = 0;
    scrollWind.lastX =
      typeof window !== "undefined"
        ? window.scrollX || document.documentElement.scrollLeft || 0
        : 0;

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

    const updateScrollWind = (time: number, isScrolling: boolean) => {
      if (typeof window === "undefined") return;

      const isMdUp = fullW >= 768;
      const mode = (window as any).__hsMode as "horizontal" | "vertical" | undefined;
      const st =
        mode === "horizontal"
          ? (ScrollTrigger.getById("hs-horizontal") as ScrollTrigger | null)
          : null;

      if (!isScrolling) {
        scrollWind.vx = 0;
        scrollWind.lastT = time;
        if (mode === "horizontal" && st) scrollWind.lastProgress = st.progress ?? 0;
        else scrollWind.lastX = window.scrollX || document.documentElement.scrollLeft || 0;
        return;
      }

      if (!scrollWind.lastT) {
        scrollWind.lastT = time;
        if (mode === "horizontal" && st) scrollWind.lastProgress = st.progress ?? 0;
        else scrollWind.lastX = window.scrollX || document.documentElement.scrollLeft || 0;
        return;
      }

      const dt = clamp((time - scrollWind.lastT) / 1000, 0.008, 0.05);
      scrollWind.lastT = time;

      if (!isMdUp) {
        scrollWind.vx = 0;
        if (mode === "horizontal" && st) scrollWind.lastProgress = st.progress ?? 0;
        else scrollWind.lastX = window.scrollX || document.documentElement.scrollLeft || 0;
        return;
      }

      if (mode === "vertical") {
        scrollWind.vx *= 0.9;
        if (Math.abs(scrollWind.vx) < 0.01) scrollWind.vx = 0;
        scrollWind.lastX = window.scrollX || document.documentElement.scrollLeft || 0;
        return;
      }

      let vx = 0;
      if (mode === "horizontal" && st) {
        const progress = st.progress ?? 0;
        const delta = progress - scrollWind.lastProgress;
        if (Math.abs(delta) < 0.0004) {
          scrollWind.lastProgress = progress;
          scrollWind.vx = 0;
          return;
        }
        const amount = Math.max(1, (st.end ?? 0) - (st.start ?? 0));
        vx = delta * amount / dt;
        scrollWind.lastProgress = progress;
      } else {
        const x = window.scrollX || document.documentElement.scrollLeft || 0;
        const dx = x - scrollWind.lastX;
        if (Math.abs(dx) < 0.5) {
          scrollWind.lastX = x;
          scrollWind.vx = 0;
          return;
        }
        vx = dx / dt;
        scrollWind.lastX = x;
      }

      const norm = clamp(vx / SCROLL_WIND_NORM, -SCROLL_WIND_MAX, SCROLL_WIND_MAX);
      const normScaled = safariDesktop ? norm * SAFARI_SCROLL_WIND_MULT : norm;
      const smooth = safariDesktop ? SAFARI_SCROLL_WIND_SMOOTH : SCROLL_WIND_SMOOTH;
      scrollWind.vx = scrollWind.vx * (1 - smooth) + normScaled * smooth;
      if (Math.abs(scrollWind.vx) < 0.01) scrollWind.vx = 0;
      if (Math.abs(scrollWind.vx) > 0.01) scrollWind.lastMoveT = time;

      debugStateRef.current.scrollVx = scrollWind.vx;
      debugStateRef.current.lastWindAt = time;
    };

    const updateAnchor = () => {
      const a = readAnchor();
      const dx = a.x - startX;
      const dy = a.y - startY;
      if (Math.abs(dx) + Math.abs(dy) < 0.5) return;

      for (let i = 0; i < COUNT; i++) {
        pos[i * 3 + 0] += dx;
        pos[i * 3 + 1] += dy;

        prev[i * 3 + 0] += dx;
        prev[i * 3 + 1] += dy;

        rest[i * 3 + 0] += dx;
        rest[i * 3 + 1] += dy;
      }

      for (let ry = 0; ry < ROWS; ry++) {
        const i = ry * 3;
        rowPos[i + 0] += dx;
        rowPos[i + 1] += dy;
        rowPrev[i + 0] += dx;
        rowPrev[i + 1] += dy;
      }

      startX = a.x;
      startY = a.y;
    };

    const clampGrabTarget = (i: number, targetX: number, targetY: number) => {
      const cx = i % COLS;
      const anchorI = idx(cx, 0);
      const anchorX = rest[anchorI * 3 + 0];
      const anchorY = rest[anchorI * 3 + 1];
      const restLen = Math.hypot(rest[i * 3 + 0] - anchorX, rest[i * 3 + 1] - anchorY);

      let tx = targetX;
      let ty = targetY;

      const dx = tx - anchorX;
      const dy = ty - anchorY;
      const dist = Math.hypot(dx, dy) || 1;
      const maxLen = Math.max(12, restLen * GRAB_MAX_STRETCH);

      if (dist > maxLen) {
        const eased = maxLen + (dist - maxLen) * GRAB_OVERDRAG;
        const s = eased / dist;
        tx = anchorX + dx * s;
        ty = anchorY + dy * s;
      }

      return { x: tx, y: ty };
    };

    const enforceGrab = () => {
      const drag = dragRef.current;
      if (!ENABLE_FABRIC_DRAG) return;
      if (drag.mode !== "grab") return;
      if (drag.dragIndex < 0) return;

      const i = drag.dragIndex;
      const cx = i % COLS;
      const cy = Math.floor(i / COLS);
      const clamped = clampGrabTarget(i, drag.targetX, drag.targetY);
      const tx = clamped.x;
      const ty = clamped.y;

      pos[i * 3 + 0] = tx;
      pos[i * 3 + 1] = ty;
      pos[i * 3 + 2] = clamp(pos[i * 3 + 2], -10, 10);

      prev[i * 3 + 0] = tx;
      prev[i * 3 + 1] = ty;
      prev[i * 3 + 2] = pos[i * 3 + 2];
      const baseX = rest[i * 3 + 0];
      const baseY = rest[i * 3 + 1];

      for (let dy = -GRAB_SOFT_RADIUS; dy <= GRAB_SOFT_RADIUS; dy++) {
        const ry = cy + dy;
        if (ry < 0 || ry >= ROWS) continue;
        for (let dx = -GRAB_SOFT_RADIUS; dx <= GRAB_SOFT_RADIUS; dx++) {
          const rx = cx + dx;
          if (rx < 0 || rx >= COLS) continue;
          const j = idx(rx, ry);
          if (j === i || pinned(j)) continue;

          const dist = Math.hypot(dx, dy);
          if (dist > GRAB_SOFT_RADIUS) continue;
          const t = 1 - dist / GRAB_SOFT_RADIUS;
          const w = GRAB_SOFT_STRENGTH * t * t;

          const nx = tx + (rest[j * 3 + 0] - baseX);
          const ny = ty + (rest[j * 3 + 1] - baseY);

          pos[j * 3 + 0] = lerp(pos[j * 3 + 0], nx, w);
          pos[j * 3 + 1] = lerp(pos[j * 3 + 1], ny, w);
          prev[j * 3 + 0] = pos[j * 3 + 0];
          prev[j * 3 + 1] = pos[j * 3 + 1];
        }
      }
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

    const baseFps = 60;
    let lastFrameTime = 0;

    const scheduleNext = (delayMs = 0) => {
      if (!isActive) return;
      if (delayMs <= 0) {
        raf = window.requestAnimationFrame(draw);
      } else {
        if (timeoutId) window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          timeoutId = null;
          raf = window.requestAnimationFrame(draw);
        }, delayMs);
      }
    };

    let paused = false;
    const setPaused = (next: boolean) => {
      paused = next;
      if (!paused) {
        lastT = 0;
        lastFrameTime = 0;
        scheduleNext(0);
      }
    };

    const draw = (time: number) => {
      if (!canvasReadyRef.current && isActive) {
        canvasReadyRef.current = true;
        setCanvasReady(true);
      }

      if (paused) {
        lastT = time;
        lastFrameTime = time;
        return;
      }

      const docHidden = typeof document !== "undefined" && document.visibilityState !== "visible";
      if (docHidden) {
        scheduleNext(250);
        return;
      }
      if (safariDesktop && !isShownRef.current) {
        lastT = time;
        lastFrameTime = time;
        scheduleNext(160);
        return;
      }

      const isTransitioning =
        !!(window as any).__heroPending ||
        !!(window as any).__pageTransitionPending ||
        (typeof document !== "undefined" && (document.documentElement as any).dataset?.homeHold === "1");
      const lowCost = safariDesktop && isTransitioning;
      const isScrolling = !!(window as any).__appScrolling;

      if (safariDesktop) {
        const targetFps = isTransitioning ? 30 : baseFps;
        const frameInterval = 1000 / targetFps;
        if (lastFrameTime && time - lastFrameTime < frameInterval) {
          scheduleNext(0);
          return;
        }
      }
      lastFrameTime = time;

      const maxDt = safariDesktop ? 0.05 : 0.033;
      const dt = lastT ? clamp((time - lastT) / 1000, 0.008, maxDt) : 0.016;
      lastT = time;

      resize();
      updateAnchor();
      updateStripHeight(sizeProxyRef.current.height || BASE_SHAPE_HEIGHT);
      updateScrollWind(time, isScrolling);
      const scrollSettling = time - scrollWindRef.current.lastMoveT < 220;
      const scrollActive = isScrolling
        ? scrollSettling || Math.abs(scrollWindRef.current.vx) > 0.002
        : scrollSettling;
      if (scrollActive) lastActiveAt = time;
      if (!sizeTweenRef.current || !sizeTweenRef.current.isActive()) {
        sizeMotionRef.current.vel *= 0.9;
        if (Math.abs(sizeMotionRef.current.vel) < 0.0005) sizeMotionRef.current.vel = 0;
      }
      if (animWind.current.v < 0.0005) animWind.current.v = 0;
      if (reveal.current.v < 0.0005) reveal.current.v = 0;
      if (pull.current.v < 0.0005) pull.current.v = 0;
      if (release.current.v < 0.0005) release.current.v = 0;

      const extra = Math.max(0, stripHeight - BASE_SHAPE_HEIGHT);
      const topH = BASE_RECT_HEIGHT + extra;

      const dropActive = safariDesktop && dropActiveRef.current;
      let busy = false;
      const pointer = pointerRef.current;
      const pointerAge = pointer.active ? time - pointer.lastT : Infinity;
      const pointerIdle = pointer.active && pointerAge > 120;
      if (pointerIdle) {
        pointer.vx *= 0.6;
        pointer.vy *= 0.6;
        if (Math.abs(pointer.vx) < 0.001) pointer.vx = 0;
        if (Math.abs(pointer.vy) < 0.001) pointer.vy = 0;
      }
      const pointerActive = pointer.active && !pointerIdle;

      if (safariDesktop) {
        const drag = dragRef.current;
        const isGrab = drag.mode === "grab";
        const isReturn = drag.mode === "return";
        const returnEase = isReturn
          ? easeOutCubic(clamp((time - drag.returnT0) / RETURN_MS, 0, 1))
          : 0;

        const damping = scrollActive ? SAFARI_DAMPING_SCROLLING : SAFARI_DAMPING_IDLE;
        const gravity = SAFARI_GRAVITY;
        const tetherBase = isReturn ? lerp(8, 22, returnEase) : 22;
        const zTetherBase = isReturn ? lerp(10, 28, returnEase) : 28;
        const grabTether = isGrab ? SAFARI_GRAB_TETHER_MULT : 1;
        const grabZTether = isGrab ? SAFARI_GRAB_Z_TETHER_MULT : 1;
        const tether = tetherBase * SAFARI_TETHER_MULT * grabTether;
        const zTether = zTetherBase * SAFARI_Z_TETHER_MULT * grabZTether;

        const introActive = introRef.current.active;
        const introAge = introActive ? time - introRef.current.t0 : 0;
        let flutter = 0;
        if (introActive) {
          const flutterMs = INTRO_FLUTTER_MS * 0.55;
          flutter = clamp(1 - introAge / flutterMs, 0, 1);
          if (flutter <= 0.0001) introRef.current.active = false;
        }
        flutter *= SAFARI_FLUTTER_MULT;
        if (lowCost && flutter > 0) flutter = 0;

        const perfDrop = dropActive || (introAge > 0 && introAge < 520);
        const perfLite = lowCost || perfDrop;

        const windStrength = (perfLite ? 1200 : 1600) * SAFARI_WIND_MULT;
        const liftStrength = (perfLite ? 90 : 120) * SAFARI_LIFT_MULT;
        const scrollWindStrength = SCROLL_WIND_STRENGTH * (perfLite ? 0.25 : 1);

        const anim = clamp(animWind.current.v, 0, 1);
        const velAbs = Math.abs(sizeMotionRef.current.vel);
        const velNorm = velAbs < 0.06 ? 0 : clamp(velAbs / 6, 0, 1);
        const rel = release.current.v;
        const scrollV = scrollWindRef.current.vx;
        const p = pointer;
        const grabX = drag.targetX;
        const grabY = drag.targetY;

        let grabRow = isGrab ? drag.grabRow : -1;
        if (isGrab && grabRow < 1) {
          let best = 1;
          let bestD = 1e9;
          for (let ry = 1; ry < ROWS; ry++) {
            const i = ry * 3;
            const dx = rowPos[i + 0] - grabX;
            const dy = rowPos[i + 1] - grabY;
            const d = dx * dx + dy * dy;
            if (d < bestD) {
              bestD = d;
              best = ry;
            }
          }
          drag.grabRow = best;
          grabRow = best;
        }

        if (flutter > 0.0001) {
          for (let ry = 0; ry < ROWS; ry++) {
            const w = flutter * INTRO_FLUTTER_SCALE * (0.2 + 0.8 * rowT[ry]);
            rowFlutterAx[ry] = Math.sin(time * 0.01 + rowNorm[ry] * 5.5) * 2400 * w;
            rowFlutterAz[ry] = Math.cos(time * 0.013 + rowNorm[ry] * 4.2) * 55 * w;
          }
        } else {
          for (let ry = 0; ry < ROWS; ry++) {
            rowFlutterAx[ry] = 0;
            rowFlutterAz[ry] = 0;
          }
        }

        const motion = !perfLite ? Math.max(anim, velNorm * SIZE_VEL_TURBULENCE) : 0;
        if (motion > 0.0001) {
          for (let ry = 0; ry < ROWS; ry++) {
            const w = motion * SAFARI_ANIM_MULT * (0.25 + 0.75 * rowT[ry]);
            rowAnimAx[ry] = Math.sin(time * 0.012 + rowNorm[ry] * 6.0) * 1650 * w;
            rowAnimAz[ry] = Math.cos(time * 0.015 + rowNorm[ry] * 4.7) * 42 * w;
            rowAnimAy[ry] = Math.sin(time * 0.009 + rowNorm[ry] * 3.3) * 620 * w;
          }
        } else {
          for (let ry = 0; ry < ROWS; ry++) {
            rowAnimAx[ry] = 0;
            rowAnimAy[ry] = 0;
            rowAnimAz[ry] = 0;
          }
        }

        if (!lowCost && rel > 0.0001) {
          for (let ry = 0; ry < ROWS; ry++) {
            const w = rel * SAFARI_RELEASE_MULT * (0.15 + 0.85 * rowT[ry]);
            rowReleaseAx[ry] = Math.sin(time * 0.014 + rowNorm[ry] * 5.2) * 1400 * w;
            rowReleaseAy[ry] = Math.sin(time * 0.010 + rowNorm[ry] * 3.1) * 900 * w;
            rowReleaseAz[ry] = Math.cos(time * 0.013 + rowNorm[ry] * 4.1) * 38 * w;
          }
        } else {
          for (let ry = 0; ry < ROWS; ry++) {
            rowReleaseAx[ry] = 0;
            rowReleaseAy[ry] = 0;
            rowReleaseAz[ry] = 0;
          }
        }

        const grabActive = isGrab && grabRow >= 1;

        let rowSpeedMax = 0;
        for (let ry = 0; ry < ROWS; ry++) {
          const restI = idx(centerCol, ry);
          const restX = rest[restI * 3 + 0];
          const restY = rest[restI * 3 + 1];
          const restZ = rest[restI * 3 + 2];

          if (ry === 0) {
            rowPos[0] = restX;
            rowPos[1] = restY;
            rowPos[2] = restZ;
            rowPrev[0] = restX;
            rowPrev[1] = restY;
            rowPrev[2] = restZ;
            continue;
          }

          const i = ry * 3;
          const x = rowPos[i + 0];
          const y = rowPos[i + 1];
          const z = rowPos[i + 2];

          const px = rowPrev[i + 0];
          const py = rowPrev[i + 1];
          const pz = rowPrev[i + 2];

          const vx = (x - px) * damping;
          const vy = (y - py) * damping;
          const vz = (z - pz) * damping;
          const vAbs = Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
          if (vAbs > rowSpeedMax) rowSpeedMax = vAbs;

          const tRow = rowT[ry];
          const restPull = isGrab ? lerp(0.7, SAFARI_GRAB_REST_MIN, tRow) : 1;

          let ax = (restX - x) * tether * restPull;
          let ay = gravity + (restY - y) * tether * restPull;
          let az = (restZ - z) * zTether * restPull;

          if (pointerActive) {
            const dx = x - p.x;
            const dy = y - p.y;
            const r2 = dx * dx + dy * dy;
            const fall = 1 / (1 + r2 / (28 * 28));

            ax += p.vx * windStrength * fall * (0.25 + 0.75 * tRow);
            ay += p.vy * windStrength * fall * (0.25 + 0.75 * tRow);
            az += -liftStrength * fall * (0.2 + 0.8 * tRow);
          }

          if (Math.abs(scrollV) > 0.0001) {
            ax -= scrollV * scrollWindStrength * (0.2 + 0.8 * tRow);
          }

          const tug = pull.current.v * (lowCost ? 0.5 : 1);
          if (tug > 0.0001) {
            ay += tug * 9000 * tRow;
            az += -tug * 260 * tRow;
          }

          const rev = reveal.current.v * (lowCost ? 0.6 : 1);
          if (rev > 0.0001) {
            ay += rev * REVEAL_KICK_PULL * tRow;
            az += -rev * 340 * tRow;
          }

          ax += rowFlutterAx[ry] + rowAnimAx[ry] + rowReleaseAx[ry];
          ay += rowAnimAy[ry] + rowReleaseAy[ry];
          az += rowFlutterAz[ry] + rowAnimAz[ry] + rowReleaseAz[ry];

          rowPrev[i + 0] = x;
          rowPrev[i + 1] = y;
          rowPrev[i + 2] = z;

          rowPos[i + 0] = x + vx + ax * dt * dt;
          rowPos[i + 1] = y + vy + ay * dt * dt;
          rowPos[i + 2] = z + vz + az * dt * dt;
        }

        if (grabActive) {
          const gi = grabRow * 3;
          rowPos[gi + 0] = grabX;
          rowPos[gi + 1] = grabY;
          rowPrev[gi + 0] = grabX;
          rowPrev[gi + 1] = grabY;
        }

        const settling = rowSpeedMax / Math.max(dt, 0.008) > SETTLE_SPEED;
        if (settling) lastActiveAt = time;

        const isPinnedRow = (r: number) => r === 0 || (grabActive && r === grabRow);

        const iterRow = perfLite ? 2 : 3;
        for (let it = 0; it < iterRow; it++) {
          for (let ry = 1; ry < ROWS; ry++) {
            const a = ry - 1;
            const b = ry;
            const ai = a * 3;
            const bi = b * 3;

            const restA = idx(centerCol, a);
            const restB = idx(centerCol, b);
            const restLen = Math.hypot(
              rest[restB * 3 + 0] - rest[restA * 3 + 0],
              rest[restB * 3 + 1] - rest[restA * 3 + 1],
              rest[restB * 3 + 2] - rest[restA * 3 + 2]
            );

            const L = restLen * (grabActive ? SAFARI_GRAB_STRETCH : 1);
            const dx = rowPos[bi + 0] - rowPos[ai + 0];
            const dy = rowPos[bi + 1] - rowPos[ai + 1];
            const dz = rowPos[bi + 2] - rowPos[ai + 2];
            const d = Math.hypot(dx, dy, dz) || 1;
            const diff = (d - L) / d;

            const aPinned = isPinnedRow(a);
            const bPinned = isPinnedRow(b);
            if (aPinned && bPinned) continue;

            if (aPinned) {
              rowPos[bi + 0] -= dx * diff;
              rowPos[bi + 1] -= dy * diff;
              rowPos[bi + 2] -= dz * diff;
            } else if (bPinned) {
              rowPos[ai + 0] += dx * diff;
              rowPos[ai + 1] += dy * diff;
              rowPos[ai + 2] += dz * diff;
            } else {
              rowPos[ai + 0] += dx * diff * 0.5;
              rowPos[ai + 1] += dy * diff * 0.5;
              rowPos[ai + 2] += dz * diff * 0.5;
              rowPos[bi + 0] -= dx * diff * 0.5;
              rowPos[bi + 1] -= dy * diff * 0.5;
              rowPos[bi + 2] -= dz * diff * 0.5;
            }
          }
        }

        const minX = -RETURN_PAD_X;
        const maxX = fullW + RETURN_PAD_X;
        const minY = -RETURN_PAD;
        const maxY = fullH + RETURN_PAD;
        for (let ry = 1; ry < ROWS; ry++) {
          const i = ry * 3;
          rowPos[i + 0] = clamp(rowPos[i + 0], minX, maxX);
          rowPos[i + 1] = clamp(rowPos[i + 1], minY, maxY);
          rowPos[i + 2] = clamp(rowPos[i + 2], -18, 18);
        }

        for (let ry = 0; ry < ROWS; ry++) {
          const baseI = ry * 3;
          const baseX = rowPos[baseI + 0];
          const baseY = rowPos[baseI + 1];
          const baseZ = rowPos[baseI + 2];

          const dxRow = rowPos[baseI + 0] - rowPrev[baseI + 0];
          const dyRow = rowPos[baseI + 1] - rowPrev[baseI + 1];
          const dzRow = rowPos[baseI + 2] - rowPrev[baseI + 2];

          for (let cx = 0; cx < COLS; cx++) {
            const t = cx / (COLS - 1) - 0.5;
            const i = idx(cx, ry);
            const x = baseX + t * STRIP_W;

            pos[i * 3 + 0] = x;
            pos[i * 3 + 1] = baseY;
            pos[i * 3 + 2] = baseZ;

            prev[i * 3 + 0] = x - dxRow;
            prev[i * 3 + 1] = baseY - dyRow;
            prev[i * 3 + 2] = baseZ - dzRow;
          }
        }

        busy =
          dropActive ||
          isTransitioning ||
          pointerActive ||
          drag.mode !== "idle" ||
          Math.abs(scrollWindRef.current.vx) > 0.002 ||
          animWind.current.v > 0.001 ||
          reveal.current.v > 0.001 ||
          pull.current.v > 0.001 ||
          release.current.v > 0.001 ||
          Math.abs(sizeMotionRef.current.vel) > 0.01;
        if (time - lastActiveAt < SETTLE_HOLD_MS) busy = true;
      } else {
        const drag = dragRef.current;
        busy = dropActive;
        const isGrab = drag.mode === "grab";
        let isReturn = drag.mode === "return";

        // Return progress
        const returnAlpha = isReturn ? clamp((time - drag.returnT0) / RETURN_MS, 0, 1) : 0;
        const returnEase = easeOutCubic(returnAlpha);

        // Physics
        const damping = 0.975;
        const gravity = 1400;

        // grabbing: very low shape pull so it can travel across the window
        // returning: ramp back up so it "falls back" naturally
        const tether = isGrab ? 9 : isReturn ? lerp(9, 26, returnEase) : 26;
        const zTether = isGrab ? 12 : isReturn ? lerp(12, 34, returnEase) : 34;

        const p = pointer;

        if (ENABLE_FABRIC_DRAG && isGrab && drag.dragIndex < 0) {
          drag.dragIndex = pickNearestVertexUnpinned(p.x, p.y);
        }

        // intro flutter (decays to 0)
        const introActive = introRef.current.active;
        const introAge = introActive ? time - introRef.current.t0 : 0;
        let flutter = 0;
        if (introActive) {
          const flutterMs = safariDesktop ? INTRO_FLUTTER_MS * 0.55 : INTRO_FLUTTER_MS;
          flutter = clamp(1 - introAge / flutterMs, 0, 1);
          if (flutter <= 0.0001) introRef.current.active = false;
        }
        if (lowCost && flutter > 0) flutter = 0;

        const perfDrop = safariDesktop && (dropActive || (introAge > 0 && introAge < 520));
        const perfLite = lowCost || perfDrop;

        const windStrength = perfLite ? 1200 : safariDesktop ? 1600 : 1800;
        const liftStrength = perfLite ? 90 : safariDesktop ? 120 : 140;
        const scrollWindStrength = SCROLL_WIND_STRENGTH * (perfLite ? 0.25 : 1);

        // wind during show/size animations
        const anim = clamp(animWind.current.v, 0, 1);
        const velAbs = Math.abs(sizeMotionRef.current.vel);
        const velNorm = velAbs < 0.06 ? 0 : clamp(velAbs / 6, 0, 1);

        // extra “release” flutter at the start of return
        const rel = release.current.v;
        const scrollV = scrollWindRef.current.vx;

        if (flutter > 0.0001) {
          for (let ry = 0; ry < ROWS; ry++) {
            const w = flutter * INTRO_FLUTTER_SCALE * (0.2 + 0.8 * rowT[ry]);
            rowFlutterAx[ry] = Math.sin(time * 0.01 + rowNorm[ry] * 5.5) * 2400 * w;
            rowFlutterAz[ry] = Math.cos(time * 0.013 + rowNorm[ry] * 4.2) * 55 * w;
          }
        } else {
          for (let ry = 0; ry < ROWS; ry++) {
            rowFlutterAx[ry] = 0;
            rowFlutterAz[ry] = 0;
          }
        }

        const motion = !perfLite ? Math.max(anim, velNorm * SIZE_VEL_TURBULENCE) : 0;
        if (motion > 0.0001) {
          for (let ry = 0; ry < ROWS; ry++) {
            const w = motion * (0.25 + 0.75 * rowT[ry]);
            rowAnimAx[ry] = Math.sin(time * 0.012 + rowNorm[ry] * 6.0) * 1650 * w;
            rowAnimAz[ry] = Math.cos(time * 0.015 + rowNorm[ry] * 4.7) * 42 * w;
            rowAnimAy[ry] = Math.sin(time * 0.009 + rowNorm[ry] * 3.3) * 620 * w;
          }
        } else {
          for (let ry = 0; ry < ROWS; ry++) {
            rowAnimAx[ry] = 0;
            rowAnimAy[ry] = 0;
            rowAnimAz[ry] = 0;
          }
        }

        if (!lowCost && rel > 0.0001) {
          for (let ry = 0; ry < ROWS; ry++) {
            const w = rel * (0.15 + 0.85 * rowT[ry]);
            rowReleaseAx[ry] = Math.sin(time * 0.014 + rowNorm[ry] * 5.2) * 1400 * w;
            rowReleaseAy[ry] = Math.sin(time * 0.010 + rowNorm[ry] * 3.1) * 900 * w;
            rowReleaseAz[ry] = Math.cos(time * 0.013 + rowNorm[ry] * 4.1) * 38 * w;
          }
        } else {
          for (let ry = 0; ry < ROWS; ry++) {
            rowReleaseAx[ry] = 0;
            rowReleaseAy[ry] = 0;
            rowReleaseAz[ry] = 0;
          }
        }

        let speedMax = 0;
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
            const clamped = clampGrabTarget(i, drag.targetX, drag.targetY);
            pos[i * 3 + 0] = clamped.x;
            pos[i * 3 + 1] = clamped.y;
            pos[i * 3 + 2] = -10;

            prev[i * 3 + 0] = pos[i * 3 + 0];
            prev[i * 3 + 1] = pos[i * 3 + 1];
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
          const vAbs = Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
          if (vAbs > speedMax) speedMax = vAbs;

          let ax = 0;
          let ay = gravity;
          let az = 0;

          // return-to-shape
          ax += (rest[i * 3 + 0] - x) * tether;
          ay += (rest[i * 3 + 1] - y) * tether;
          az += (rest[i * 3 + 2] - z) * zTether;

          const ry = Math.floor(i / COLS);
          const tRow = rowT[ry];

          if (pointerActive) {
            const dx = x - p.x;
            const dy = y - p.y;
            const r2 = dx * dx + dy * dy;
            const fall = 1 / (1 + r2 / (28 * 28));

            ax += p.vx * windStrength * fall * (0.25 + 0.75 * tRow);
            ay += p.vy * windStrength * fall * (0.25 + 0.75 * tRow);
            az += -liftStrength * fall * (0.2 + 0.8 * tRow);
          }

          if (Math.abs(scrollV) > 0.0001) {
            ax -= scrollV * scrollWindStrength * (0.2 + 0.8 * tRow);
          }

          const tug = pull.current.v * (lowCost ? 0.5 : 1);
          if (tug > 0.0001) {
            ay += tug * 9000 * tRow;
            az += -tug * 260 * tRow;
          }

          const rev = reveal.current.v * (lowCost ? 0.6 : 1);
          if (rev > 0.0001) {
            ay += rev * REVEAL_KICK_PULL * tRow;
            az += -rev * 340 * tRow;
          }

          // intro flutter
          ax += rowFlutterAx[ry];
          az += rowFlutterAz[ry];

          // animation wind
          ax += rowAnimAx[ry];
          ay += rowAnimAy[ry];
          az += rowAnimAz[ry];

          // release “settle” (helps the return feel like a fall, not a snap)
          ax += rowReleaseAx[ry];
          ay += rowReleaseAy[ry];
          az += rowReleaseAz[ry];

          prev[i * 3 + 0] = x;
          prev[i * 3 + 1] = y;
          prev[i * 3 + 2] = z;

          pos[i * 3 + 0] = x + vx + ax * dt * dt;
          pos[i * 3 + 1] = y + vy + ay * dt * dt;
          pos[i * 3 + 2] = z + vz + az * dt * dt;
        }

        const settling = speedMax / Math.max(dt, 0.008) > SETTLE_SPEED;
        if (settling) lastActiveAt = time;

        busy =
          isTransitioning ||
          pointerActive ||
          drag.mode !== "idle" ||
          Math.abs(scrollWindRef.current.vx) > 0.002 ||
          animWind.current.v > 0.001 ||
          reveal.current.v > 0.001 ||
          pull.current.v > 0.001 ||
          release.current.v > 0.001 ||
          Math.abs(sizeMotionRef.current.vel) > 0.01;
        if (time - lastActiveAt < SETTLE_HOLD_MS) busy = true;

        // Solve constraints more during grabbing/return to smooth kinks
        const introWarm = safariDesktop && introAge > 0 && introAge < 420;
        const scrollWarm = safariDesktop && scrollActive;
        const constraintsList = scrollWarm || perfDrop || lowCost ? constraintsBase : constraintsAll;
        const ITER = busy
          ? safariDesktop
            ? (isGrab ? 12 : isReturn ? 8 : isTransitioning ? 5 : scrollWarm || perfDrop ? 4 : introWarm ? 5 : 6)
            : (isGrab ? 22 : isReturn ? 14 : isTransitioning ? 8 : 10)
          : safariDesktop
            ? 4
            : 6;

        for (let it = 0; it < ITER; it++) {
          for (let c = 0; c < constraintsList.length; c++) {
            const { a, b, rest: L } = constraintsList[c];

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
        const smoothK = busy
          ? safariDesktop
            ? 0
            : isGrab
              ? 0.3
              : isReturn
                ? lerp(0.16, 0.06, returnEase)
                : 0
          : 0;
        smoothPass(smoothK);

        if (isReturn && returnAlpha >= 1) {
          let maxD = 0;
          for (let i = 0; i < COUNT; i++) {
            if (pinned(i)) continue;
            const dx = pos[i * 3 + 0] - rest[i * 3 + 0];
            const dy = pos[i * 3 + 1] - rest[i * 3 + 1];
            const dz = pos[i * 3 + 2] - rest[i * 3 + 2];
            const d = Math.hypot(dx, dy, dz);
            if (d > maxD) maxD = d;
          }

          if (maxD < RETURN_SETTLE_DIST) {
            drag.mode = "idle";
            isReturn = false;
          }
        }

        // Clamps
        if (ENABLE_FABRIC_DRAG && isGrab) {
          for (let i = 0; i < COUNT; i++) {
            if (pinned(i)) continue;
            pos[i * 3 + 0] = clamp(pos[i * 3 + 0], -VIEWPORT_PAD, fullW + VIEWPORT_PAD);
            pos[i * 3 + 1] = clamp(pos[i * 3 + 1], -VIEWPORT_PAD, fullH + VIEWPORT_PAD);
            pos[i * 3 + 2] = clamp(pos[i * 3 + 2], -18, 18);
          }
        } else if (isReturn) {
          const minX = -RETURN_PAD_X;
          const maxX = fullW + RETURN_PAD_X;
          const minY = lerp(-RETURN_PAD, startY - 8, returnEase);
          const maxY = lerp(fullH + RETURN_PAD, startY + stripHeight + 14, returnEase);

          for (let i = 0; i < COUNT; i++) {
            if (pinned(i)) continue;
            pos[i * 3 + 0] = clamp(pos[i * 3 + 0], minX, maxX);
            pos[i * 3 + 1] = clamp(pos[i * 3 + 1], minY, maxY);
            pos[i * 3 + 2] = clamp(pos[i * 3 + 2], -18, 18);
          }
        } else {
          const minX = -RETURN_PAD_X;
          const maxX = fullW + RETURN_PAD_X;
          const minY = -RETURN_PAD;
          const maxY = fullH + RETURN_PAD;

          for (let i = 0; i < COUNT; i++) {
            if (pinned(i)) continue;
            pos[i * 3 + 0] = clamp(pos[i * 3 + 0], minX, maxX);
            pos[i * 3 + 1] = clamp(pos[i * 3 + 1], minY, maxY);
            pos[i * 3 + 2] = clamp(pos[i * 3 + 2], -18, 18);
          }
        }
      }

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

      scheduleNext(busy ? 0 : safariDesktop ? 120 : 80);

      if ((window as any).__bookmarkDebug) {
        if (!debugEl) {
          debugEl = document.getElementById("bookmark-debug") as HTMLDivElement | null;
          if (!debugEl) {
            debugEl = document.createElement("div");
            debugEl.id = "bookmark-debug";
            debugEl.style.position = "fixed";
            debugEl.style.right = "12px";
            debugEl.style.bottom = "12px";
            debugEl.style.zIndex = "10050";
            debugEl.style.padding = "8px 10px";
            debugEl.style.borderRadius = "8px";
            debugEl.style.background = "rgba(0,0,0,0.65)";
            debugEl.style.color = "#fff";
            debugEl.style.font = "12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace";
            debugEl.style.pointerEvents = "none";
            document.body.appendChild(debugEl);
          }
        }

        if (time >= debugNextAt && debugEl) {
          const d = debugStateRef.current;
          debugEl.textContent = [
            `bookmark-debug`,
            `targetH ${d.targetH.toFixed(1)}  appliedH ${d.appliedH.toFixed(1)}`,
            `stripH ${d.stripH.toFixed(1)}  anchorY ${d.anchorY.toFixed(1)}`,
            `scrollVx ${d.scrollVx.toFixed(3)}  dt ${(dt * 1000).toFixed(1)}ms`,
            `lastApply ${(time - d.lastApplyAt).toFixed(0)}ms`,
          ].join("\n");
          debugNextAt = time + 240;
        }
      } else if (debugEl) {
        debugEl.remove();
        debugEl = null;
      }
    };

    scheduleNext(0);

    const onNavStart = () => {
      if (!safariDesktop) return;
      setPaused(true);
    };
    const onNavEnd = () => {
      if (!safariDesktop) return;
      setPaused(false);
    };

    window.addEventListener(APP_EVENTS.NAV_START, onNavStart);
    window.addEventListener(APP_EVENTS.NAV_END, onNavEnd);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      isActive = false;
      window.removeEventListener("resize", onResize);
      window.removeEventListener(APP_EVENTS.NAV_START, onNavStart);
      window.removeEventListener(APP_EVENTS.NAV_END, onNavEnd);
      window.cancelAnimationFrame(raf);
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = null;

      simApiRef.current = null;

      if (debugEl) {
        debugEl.remove();
        debugEl = null;
      }

      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(uvBuf);
      gl.deleteBuffer(idxBuf);
      gl.deleteProgram(prog);
    };
  }, [overlayEl, simEnabled]);

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
  const fallbackVisible = !simEnabled || !webglOk || !canvasReady;
  const canvasVisible = simEnabled && webglOk && canvasReady && isShown;

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
