// components/header/bookmark-link-fabric.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type BookmarkLinkFabricProps = {
  href?: string;
  side?: "left" | "right";
  className?: string;
  slug?: string;
  heroImgUrl?: string;
};

const TOP_THRESHOLD = 24;
const TUG_COOLDOWN_MS = 1000;
const CANVAS_BLEED = 16;

// Target brand red
const RED_500 = { r: 251 / 255, g: 44 / 255, b: 54 / 255 };

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
}: BookmarkLinkFabricProps) {
  const { loaderDone } = useLoader();
  const router = useRouter();
  const pathname = usePathname();

  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const shownRef = useRef(false);
  const [webglOk, setWebglOk] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasReadyRef = useRef(false);

  const pull = useRef({ v: 0 }); // 0..1
  const lastTugAtRef = useRef(0);

  // drag/click suppression
  const dragRef = useRef({
    down: false,
    moved: false,
    startX: 0,
    startY: 0,
    suppressClick: false,
    dragIndex: -1,
    targetX: 0,
    targetY: 0,
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
    gsap.set(el, { autoAlpha: 1 });
    gsap.fromTo(
      el,
      { y: -42 },
      { y: 0, duration: 0.7, ease: "bounce.out", overwrite: "auto" }
    );
  }, []);

  const doNavigate = useCallback(async () => {
    const rawY = getRawScrollY();
    const atTop = rawY <= TOP_THRESHOLD;

    const saved = getSavedHomeSection();
    const enteredKind =
      ((window as any).__pageTransitionLast as PageTransitionKind | undefined) ?? "simple";

    const isHeroBackType =
      saved?.type === "project-block" || saved?.type === "page-link-section";

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

      if (dragRef.current.suppressClick) {
        e.preventDefault();
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
              .to(pull.current, { v: 1, duration: 0.10, ease: "power2.out" })
              .to(pull.current, { v: 0, duration: 0.18, ease: "power2.in" });
          });
        }

        await doNavigate();
      } finally {
        clickLock.current = false;
      }
    },
    [doNavigate, pathname]
  );

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

  // Pointer -> local coords in anchor
  const updatePointer = useCallback((clientX: number, clientY: number) => {
    const a = linkRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();

    const x = clamp(clientX - r.left, 0, r.width);
    const y = clamp(clientY - r.top, 0, r.height);

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

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      if (e.button !== 0) return;

      const a = linkRef.current;
      if (!a) return;

      dragRef.current.down = true;
      dragRef.current.moved = false;
      dragRef.current.suppressClick = false;
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;

      updatePointer(e.clientX, e.clientY);
      pointerRef.current.active = true;

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

      if (dragRef.current.down) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        if (!dragRef.current.moved && Math.hypot(dx, dy) > 5) {
          dragRef.current.moved = true;
          dragRef.current.suppressClick = true;
        }
      }
    },
    [updatePointer]
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLAnchorElement>) => {
    dragRef.current.down = false;
    dragRef.current.dragIndex = -1;

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
  }, []);

  const onPointerEnter = useCallback(
    (e: React.PointerEvent<HTMLAnchorElement>) => {
      pointerRef.current.active = true;
      updatePointer(e.clientX, e.clientY);
    },
    [updatePointer]
  );

  const onPointerLeave = useCallback(() => {
    pointerRef.current.active = false;
    pointerRef.current.vx *= 0.25;
    pointerRef.current.vy *= 0.25;
    dragRef.current.down = false;
    dragRef.current.dragIndex = -1;
  }, []);

  // WebGL cloth (NO prefers-reduced-motion gating)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const canvas = canvasRef.current;
    const host = linkRef.current;
    if (!canvas || !host) return;

    let isActive = true;
    canvasReadyRef.current = false;
    setCanvasReady(false);

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

    // Enable derivatives if available (fixes fwidth)
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

      float aaWidth(float v) {
      #if HAS_DERIV
        return fwidth(v) * 1.25 + 0.0005;
      #else
        // fallback AA in UV units (good enough, but less perfect)
        return 0.02;
      #endif
      }

      float sat(float x) { return clamp(x, 0.0, 1.0); }

      void main() {
        // Shape in UV: 24px top + 40px tail = 64px total
        float totalH = 64.0;
        float topH = 24.0;
        float tailH = 40.0;

        // V apex at 72% of tail (matches your original clip-path)
        float apexV = (topH + 0.72 * tailH) / totalH;

        float u = v_uv.x - 0.5;
        float v = v_uv.y;

        // Side edges (keep solid; just a touch of AA)
        float sideEdge = abs(u) - 0.5;
        float sideAA = aaWidth(sideEdge);
        float side = 1.0 - smoothstep(0.0, sideAA, sideEdge);

        // Notch cut (triangle)
        float notch = 1.0;
        if (v >= apexV) {
          float t = (v - apexV) / (1.0 - apexV);
          float cutHalf = 0.5 * t;
          float edge = cutHalf - abs(u);     // >0 inside the cut triangle
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

    const posBuf = gl.createBuffer();
    const uvBuf = gl.createBuffer();
    const idxBuf = gl.createBuffer();
    if (!posBuf || !uvBuf || !idxBuf || !uCanvas || !uColor) {
      setWebglOk(false);
      gl.deleteProgram(prog);
      return;
    }

    // Cloth mesh
    const COLS = 6;
    const ROWS = 22;
    const COUNT = COLS * ROWS;

    const pos = new Float32Array(COUNT * 3);
    const prev = new Float32Array(COUNT * 3);
    const rest = new Float32Array(COUNT * 3);
    const uv = new Float32Array(COUNT * 2);

    type C = { a: number; b: number; rest: number };
    const constraints: C[] = [];

    // Draw region: 16px strip centered inside 48px host, height 64px (matches original)
    const STRIP_W = 16;
    const STRIP_H = 64;
    const baseRect = host.getBoundingClientRect();
    const baseW = Math.max(1, Math.round(baseRect.width || 48));
    const baseH = Math.max(1, Math.round(baseRect.height || 92));
    const canvasW = baseW + CANVAS_BLEED * 2;
    const canvasH = baseH + CANVAS_BLEED * 2;
    const centerX = canvasW / 2;
    const startX = centerX - STRIP_W / 2;
    const startY = CANVAS_BLEED;

    const stepX = STRIP_W / (COLS - 1);
    const stepY = STRIP_H / (ROWS - 1);
    const idx = (cx: number, ry: number) => ry * COLS + cx;

    for (let ry = 0; ry < ROWS; ry++) {
      for (let cx = 0; cx < COLS; cx++) {
        const i = idx(cx, ry);
        const x = startX + cx * stepX;
        const y = startY + ry * stepY;
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
        uv[i * 2 + 1] = ry / (ROWS - 1);
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

    for (let ry = 0; ry < ROWS; ry++) {
      for (let cx = 0; cx < COLS; cx++) {
        const i = idx(cx, ry);

        // structural
        if (cx + 1 < COLS) addConstraint(i, idx(cx + 1, ry));
        if (ry + 1 < ROWS) addConstraint(i, idx(cx, ry + 1));

        // shear
        if (cx + 1 < COLS && ry + 1 < ROWS) addConstraint(i, idx(cx + 1, ry + 1));
        if (cx - 1 >= 0 && ry + 1 < ROWS) addConstraint(i, idx(cx - 1, ry + 1));

        // bend (skip-one)
        if (cx + 2 < COLS) addConstraint(i, idx(cx + 2, ry));
        if (ry + 2 < ROWS) addConstraint(i, idx(cx, ry + 2));
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

    const pickNearestVertex = (x: number, y: number) => {
      let best = -1;
      let bestD = 1e9;
      for (let i = 0; i < COUNT; i++) {
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

    const resize = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const fullW = Math.max(1, r.width + CANVAS_BLEED * 2);
      const fullH = Math.max(1, r.height + CANVAS_BLEED * 2);
      const w = Math.max(1, Math.round(fullW * dpr));
      const h = Math.max(1, Math.round(fullH * dpr));

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${fullW}px`;
        canvas.style.height = `${fullH}px`;
        canvas.style.left = `${-CANVAS_BLEED}px`;
        canvas.style.top = `${-CANVAS_BLEED}px`;
        gl.viewport(0, 0, w, h);
      }

      gl.useProgram(prog);
      gl.uniform2f(uCanvas, fullW, fullH);
    };

    const draw = (time: number) => {
      if (!canvasReadyRef.current && isActive) {
        canvasReadyRef.current = true;
        setCanvasReady(true);
      }

      raf = window.requestAnimationFrame(draw);

      const dt = lastT ? clamp((time - lastT) / 1000, 0.010, 0.033) : 0.016;
      lastT = time;

      resize();

      // Physics
      const damping = 0.985;
      const gravity = 1400; // px/s^2
      const tether = 22;
      const zTether = 28;

      // Response
      const windStrength = 1800;
      const liftStrength = 140;
      const dragStrength = 85;

      const p = pointerRef.current;
      const drag = dragRef.current;

      if (drag.down && drag.dragIndex < 0) {
        drag.dragIndex = pickNearestVertex(p.x, p.y);
      }

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

        // keep silhouette controlled
        ax += (rest[i * 3 + 0] - x) * tether;
        ay += (rest[i * 3 + 1] - y) * tether;
        az += (rest[i * 3 + 2] - z) * zTether;

        if (p.active) {
          const dx = x - p.x;
          const dy = y - p.y;
          const r2 = dx * dx + dy * dy;
          const fall = 1 / (1 + r2 / (28 * 28));

          const ry = Math.floor(i / COLS);
          const tRow = ry / (ROWS - 1);

          ax += p.vx * windStrength * fall * (0.25 + 0.75 * tRow);
          ay += p.vy * windStrength * fall * (0.25 + 0.75 * tRow);
          az += -liftStrength * fall * (0.2 + 0.8 * tRow);
        }

        const tug = pull.current.v;
        if (tug > 0.0001) {
          const ry = Math.floor(i / COLS);
          const tRow = ry / (ROWS - 1);
          ay += tug * 9000 * tRow;
          az += -tug * 260 * tRow;
        }

        if (drag.down && drag.dragIndex === i) {
          ax += (drag.targetX - x) * dragStrength;
          ay += (drag.targetY - y) * dragStrength;
          az += -120;
        }

        prev[i * 3 + 0] = x;
        prev[i * 3 + 1] = y;
        prev[i * 3 + 2] = z;

        pos[i * 3 + 0] = x + vx + ax * dt * dt;
        pos[i * 3 + 1] = y + vy + ay * dt * dt;
        pos[i * 3 + 2] = z + vz + az * dt * dt;
      }

      // Constraints
      const ITER = 7;
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

        // repin top row
        for (let cx = 0; cx < COLS; cx++) {
          const i = idx(cx, 0);
          pos[i * 3 + 0] = rest[i * 3 + 0];
          pos[i * 3 + 1] = rest[i * 3 + 1];
          pos[i * 3 + 2] = rest[i * 3 + 2];
        }
      }

      // safety clamps
      for (let i = 0; i < COUNT; i++) {
        if (pinned(i)) continue;
        pos[i * 3 + 0] = clamp(pos[i * 3 + 0], startX - 10, startX + STRIP_W + 10);
        pos[i * 3 + 1] = clamp(pos[i * 3 + 1], -8, 92 + 14);
        pos[i * 3 + 2] = clamp(pos[i * 3 + 2], -18, 18);
      }

      // draw
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(prog);
      gl.uniform3f(uColor, RED_500.r, RED_500.g, RED_500.b);

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

      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(uvBuf);
      gl.deleteBuffer(idxBuf);
      gl.deleteProgram(prog);
    };
  }, []);

  const fallbackBookmark = useMemo(() => {
    // exact original DOM bookmark
    return (
      <div className="relative flex h-full w-full items-start justify-center pointer-events-none">
        <div className="flex flex-col items-center">
          <span className="block w-4 bg-red-500 h-[24px] transition-[height] duration-300 ease-out group-hover:h-[50px]" />
          <span
            aria-hidden
            className="block w-4 h-[40px] bg-red-500 [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]"
          />
        </div>
      </div>
    );
  }, []);

  return (
    <a
      ref={linkRef}
      href={href}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      aria-label="Back"
      style={{ touchAction: "none" }}
      className={cn(
        "group fixed top-0 z-[10010] overflow-visible",
        side === "left" ? "left-6" : "right-6",
        "inline-flex items-start justify-center",
        "h-[92px] w-12",
        "opacity-0",
        className
      )}
    >
    <div className="relative h-full w-full pointer-events-none">
      {!webglOk || !canvasReady ? fallbackBookmark : null}
      {webglOk ? <canvas ref={canvasRef} className="absolute pointer-events-none" /> : null}
    </div>
  </a>
  );
}
