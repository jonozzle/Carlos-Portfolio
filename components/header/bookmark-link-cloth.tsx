// components/header/bookmark-link-cloth.tsx
"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

type BookmarkLinkClothProps = {
  href?: string;
  side?: "left" | "right";
  className?: string;
  slug?: string;
  heroImgUrl?: string;
  onHomeToggle?: () => void;
  homeLabel?: string;
  bookmarkLabel?: string;
  showBookmarkLabel?: boolean;
  printBookmarkLabel?: boolean;
  ariaControls?: string;
  ariaExpanded?: boolean;
  homeFollowRef?: React.RefObject<HTMLElement | null>;
  homeFollow?: boolean;
};

const BOOKMARK_TALL_VH = 0.5;
const BASE_RECT_HEIGHT = 24;
const TAIL_HEIGHT = 40;
const BASE_SHAPE_HEIGHT = BASE_RECT_HEIGHT + TAIL_HEIGHT;
const HOME_ANCHOR_HEIGHT = 92;
const TOP_THRESHOLD = 24;

const DROP_INNER_Y = -100;

// Cloth grid
const STRIP_W = 16;
const COLS = 10;
const ROWS = 30;

// Codepen-inspired implicit cloth settings
const SIM_OPTIONS = {
  gravity: 2000,
  structK: 10000,
  shearK: 0,
  bendK: 5000,
  dampSpring: 0,
  dampAir: 100,
  mass: 10.0,
  sleepThreshold: 0.0012,
  sleepCount: 30,
  timeStep: 0.016,
} as const;

const STRUCT_SPRING = 0;
const SHEAR_SPRING = 1;
const BEND_SPRING = 0;
const SPRING_CONSTANTS = [SIM_OPTIONS.structK, SIM_OPTIONS.shearK, SIM_OPTIONS.bendK];

// Scroll wind
const SCROLL_WIND_NORM = 100;
const SCROLL_WIND_MAX = 1.2;
const SCROLL_WIND_SMOOTH = 0.12;
const SCROLL_WIND_STRENGTH = 100;
const MOBILE_SCROLL_WIND_QUERY = "(max-width: 767px), (hover: none) and (pointer: coarse)";

// Pointer wind
const POINTER_FORCE = 1200;
const POINTER_RADIUS = 56;
const GRAB_FORCE = 0;
const GRAB_RADIUS = 96;
const HIT_PAD_BOTTOM = 24;
const GRAB_PATCH_RADIUS = 2.5;
const GRAB_SOFT_STRENGTH = 0.82;
const GRAB_MAX_STRETCH = 1.0;
const GRAB_OVERDRAG = 0.0;

const GRAB_MOVE_PX = 10;
const PASSIVE_DAMPING_PER_FRAME = 0.976;
const DRAWER_SEAM_OVERLAP_PX = 1;

// Label
const LABEL_FONT_FAMILY = `"Times New Roman", Times, serif`;
const LABEL_FONT_WEIGHT = 600;
const LABEL_FONT_PX = 11;
const LABEL_TRACK_EM = 0.3;
const LABEL_OFFSET_PX = 14;
const LABEL_TEX_SCALE = 1.2;
const LABEL_CENTER_SHIFT_PX = 1.2;
const LABEL_SWAP_OUT_MS = 180;

const BOOKMARK_RED_HEX = "#fb2c36";
const BOOKMARK_RED = { r: 251 / 255, g: 44 / 255, b: 54 / 255 };
const TEXT_RED_HEX = "#ff7a82";
const TEXT_RED = { r: 255 / 255, g: 122 / 255, b: 130 / 255 };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function readViewportHeight(): number {
  if (typeof window === "undefined") return 0;
  const vv = window.visualViewport;
  const h = vv && typeof vv.height === "number" ? vv.height : window.innerHeight;
  return Number.isFinite(h) ? h : window.innerHeight || 0;
}

function getNativeScrollY(): number {
  if (typeof window === "undefined") return 0;
  const y =
    (typeof window.scrollY === "number" ? window.scrollY : 0) ||
    (typeof document !== "undefined" && typeof document.documentElement?.scrollTop === "number"
      ? document.documentElement.scrollTop
      : 0) ||
    0;
  return Number.isFinite(y) ? Math.max(0, y) : 0;
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
  return getNativeScrollY();
}

function getTargetBookmarkHeight(isHome: boolean): number {
  const vh = readViewportHeight();
  const raw = isHome ? HOME_ANCHOR_HEIGHT : vh * BOOKMARK_TALL_VH;
  return Math.max(BASE_SHAPE_HEIGHT, raw);
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

// Adapted from Thom Chiovoloni's MIT-licensed cloth sim (CodePen NGQpxv).
class Spring {
  type: number;
  a: number;
  b: number;
  rest: number;
  iab: number;
  iba: number;

  constructor(type: number, a: number, b: number, rest: number) {
    this.type = type;
    this.rest = rest;
    this.a = a;
    this.b = b;
    this.iab = -1;
    this.iba = -1;
  }
}

class BigVec3D {
  size: number;
  data: Float32Array;

  constructor(initSize: number) {
    this.size = initSize;
    this.data = new Float32Array(initSize * 3);
  }

  copy(other: BigVec3D) {
    this.data.set(other.data);
  }

  init(x: number, y: number, z: number) {
    for (let i = 0; i < this.data.length; i += 3) {
      this.data[i + 0] = x;
      this.data[i + 1] = y;
      this.data[i + 2] = z;
    }
  }

  zero() {
    this.data.fill(0);
  }
}

function dot(a: BigVec3D, b: BigVec3D) {
  let r = 0.0;
  const size = a.size * 3;
  for (let i = 0; i < size; ++i) r += a.data[i] * b.data[i];
  return r;
}

class BigMat3D {
  size: number;
  data: Float32Array;
  posns: Uint16Array;

  constructor(diagSize: number) {
    this.size = diagSize;
    const cap = Math.max(diagSize, 16);
    this.data = new Float32Array(cap * 9);
    this.posns = new Uint16Array(cap * 2);
    for (let i = 0, j = 0; i < diagSize; ++i, j += 2) {
      this.posns[j] = i;
      this.posns[j + 1] = i;
    }
  }

  initDiag(f: number) {
    for (let i = 0, pi = 0, mi = 0; i < this.size; ++i, pi += 2, mi += 9) {
      const d = this.posns[pi] === this.posns[pi + 1] ? f : 0.0;
      for (let r = 0; r < 3; ++r) {
        for (let c = 0; c < 3; ++c) {
          this.data[mi + r * 3 + c] = r === c ? d : 0.0;
        }
      }
    }
  }

  zero() {
    this.data.fill(0);
  }

  capacity() {
    return Math.floor(this.data.length / 9);
  }

  grow_() {
    const nextData = new Float32Array(this.data.length * 2);
    nextData.set(this.data);
    this.data = nextData;

    const nextPosns = new Uint16Array(this.posns.length * 2);
    nextPosns.set(this.posns);
    this.posns = nextPosns;
  }

  push(r: number, c: number) {
    if (this.size + 1 >= this.capacity()) {
      this.grow_();
    }
    const nextIdx = this.size * 9;
    const nextPosIdx = this.size * 2;
    this.posns[nextPosIdx + 0] = r;
    this.posns[nextPosIdx + 1] = c;
    for (let i = 0; i < 9; i++) this.data[nextIdx + i] = 0.0;
    ++this.size;
    return nextIdx;
  }

  pushFront(r: number, c: number) {
    if (this.size + 1 >= this.capacity()) {
      this.grow_();
    }
    this.size++;
    for (let totalSize = this.size * 9, i = totalSize - 1; i >= 9; --i) {
      this.data[i] = this.data[i - 9];
    }
    for (let i = this.size * 2 - 1; i >= 2; --i) {
      this.posns[i] = this.posns[i - 2];
    }
    for (let i = 0; i < 9; ++i) this.data[i] = 0.0;
    this.posns[0] = r;
    this.posns[1] = c;
    return 0;
  }

  clearRow(index: number) {
    let j = 0;
    for (let i = 0, l = this.size; i < l; ++i) {
      if (this.posns[i * 2] !== index) {
        this.posns[j * 2 + 0] = this.posns[i * 2 + 0];
        this.posns[j * 2 + 1] = this.posns[i * 2 + 1];
        const mi = i * 9;
        const mj = j * 9;
        for (let mii = 0; mii < 9; ++mii) {
          this.data[mj + mii] = this.data[mi + mii];
        }
        j++;
      }
    }
    this.size = j;
  }
}

function mul(out: BigVec3D | null, mat: BigMat3D, vec: BigVec3D) {
  if (!out) out = new BigVec3D(vec.size);
  else out.init(0, 0, 0);
  const m = mat.data;
  const v = vec.data;
  const o = out.data;
  for (let i = 0, sz = mat.size; i < sz; i++) {
    const r = mat.posns[i * 2 + 0];
    const c = mat.posns[i * 2 + 1];
    const mi = i * 9;
    const vr = r * 3;
    const vc = c * 3;
    const mxx = +m[mi + 0];
    const mxy = +m[mi + 1];
    const mxz = +m[mi + 2];
    const myx = +m[mi + 3];
    const myy = +m[mi + 4];
    const myz = +m[mi + 5];
    const mzx = +m[mi + 6];
    const mzy = +m[mi + 7];
    const mzz = +m[mi + 8];
    const vx = +v[vr + 0];
    const vy = +v[vr + 1];
    const vz = +v[vr + 2];
    o[vc + 0] += vx * mxx + vy * myx + vz * mzx;
    o[vc + 1] += vx * mxy + vy * myy + vz * mzy;
    o[vc + 2] += vx * mxz + vy * myz + vz * mzz;
  }
  return out;
}

function foreach2d(w: number, h: number, fn: (i: number, j: number) => void) {
  for (let i = 0; i < h; ++i) {
    for (let j = 0; j < w; ++j) {
      fn(i, j);
    }
  }
}

class Cloth {
  cols: number;
  rows: number;
  count: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  uvs: Float32Array;
  tris: Uint16Array = new Uint16Array(0);
  rowT: Float32Array;
  rest: Float32Array;
  externalForce: Float32Array;
  springs: Spring[];
  pinnedMask: Uint8Array;
  wind: Float32Array;
  awake: number;

  X: BigVec3D;
  V: BigVec3D;
  N: BigVec3D;
  F: BigVec3D;
  dV: BigVec3D;

  A: BigMat3D;
  dFdX: BigMat3D;
  dFdV: BigMat3D;
  S: BigMat3D;

  tmpB: BigVec3D;
  tmpdFdXmV: BigVec3D;
  tmpQ: BigVec3D;
  tmpD: BigVec3D;
  tmpT: BigVec3D;
  tmpR: BigVec3D;

  constructor(cols: number, rows: number, width: number, height: number, anchorX: number, anchorY: number) {
    this.cols = cols;
    this.rows = rows;
    this.count = cols * rows;
    this.width = width;
    this.height = height;
    this.anchorX = anchorX;
    this.anchorY = anchorY;

    this.uvs = new Float32Array(this.count * 2);
    this.rowT = new Float32Array(this.count);
    this.rest = new Float32Array(this.count * 3);
    this.externalForce = new Float32Array(this.count * 3);
    this.springs = [];
    this.pinnedMask = new Uint8Array(this.count);

    this.wind = new Float32Array([0.0, 0.0, 0.0]);

    this.buildRestPositions(width, height, anchorX, anchorY);
    this.buildSprings();

    const n = this.count;
    this.X = new BigVec3D(n);
    this.X.data = new Float32Array(this.rest);
    this.V = new BigVec3D(n);
    this.N = new BigVec3D(n);
    this.F = new BigVec3D(n);
    this.dV = new BigVec3D(n);

    this.A = new BigMat3D(n);
    this.dFdX = new BigMat3D(n);
    this.dFdV = new BigMat3D(n);

    this.tmpB = new BigVec3D(n);
    this.tmpdFdXmV = new BigVec3D(n);
    this.tmpQ = new BigVec3D(n);
    this.tmpD = new BigVec3D(n);
    this.tmpT = new BigVec3D(n);
    this.tmpR = new BigVec3D(n);

    this.springs.forEach((s) => {
      s.iab = this.A.size;
      this.A.push(s.a, s.b);
      this.dFdX.push(s.a, s.b);
      this.dFdV.push(s.a, s.b);

      s.iba = this.A.size;
      this.A.push(s.b, s.a);
      this.dFdX.push(s.b, s.a);
      this.dFdV.push(s.b, s.a);
    });

    this.S = new BigMat3D(0);

    // Pin top row
    for (let cx = 0; cx < this.cols; cx++) {
      const idx = cx;
      this.pinnedMask[idx] = 1;
      this.pointStatusSet(idx, 1);
    }

    this.awake = SIM_OPTIONS.sleepCount;
  }

  isPermanentPinned(index: number) {
    return this.pinnedMask[index] === 1;
  }

  pointStatusSet(index: number, op: number) {
    if (index < 0 || index >= this.X.size) return -1;
    let st = false;
    for (let i = 0, l = this.S.size * 2; i < l; i += 2) {
      if (this.S.posns[i] === index) {
        st = true;
        break;
      }
    }
    if (st && (op === 0 || op === 2)) {
      this.S.clearRow(index);
      st = false;
    }
    if (!st && (op === 1 || op === 2)) {
      this.S.pushFront(index, index);
      this.V.data[index * 3 + 0] = 0.0;
      this.V.data[index * 3 + 1] = 0.0;
      this.V.data[index * 3 + 2] = 0.0;
      st = true;
    }
    return st;
  }

  buildRestPositions(width: number, height: number, anchorX: number, anchorY: number) {
    foreach2d(this.cols, this.rows, (i, j) => {
      const idx = i * this.cols + j;
      const u = this.cols === 1 ? 0 : j / (this.cols - 1);
      const v = this.rows === 1 ? 0 : i / (this.rows - 1);
      this.uvs[idx * 2 + 0] = u;
      this.uvs[idx * 2 + 1] = v;
      this.rowT[idx] = v;
      this.rest[idx * 3 + 0] = anchorX + u * width;
      this.rest[idx * 3 + 1] = anchorY + v * height;
      this.rest[idx * 3 + 2] = 0.0;
    });

    const tris: number[] = [];
    foreach2d(this.cols - 1, this.rows - 1, (i, j) => {
      const v0 = i * this.cols + j;
      const v1 = i * this.cols + (j + 1);
      const v2 = (i + 1) * this.cols + (j + 1);
      const v3 = (i + 1) * this.cols + j;
      tris.push(v0, v1, v2, v2, v3, v0);
    });
    this.tris = new Uint16Array(tris);
  }

  buildSprings() {
    this.springs = [];
    const idx = (cx: number, ry: number) => ry * this.cols + cx;

    for (let ry = 0; ry < this.rows; ry++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const i = idx(cx, ry);
        if (cx + 1 < this.cols) this.addSpring(STRUCT_SPRING, i, idx(cx + 1, ry));
        if (ry + 1 < this.rows) this.addSpring(STRUCT_SPRING, i, idx(cx, ry + 1));

        if (cx + 1 < this.cols && ry + 1 < this.rows) {
          this.addSpring(SHEAR_SPRING, i, idx(cx + 1, ry + 1));
        }
        if (cx - 1 >= 0 && ry + 1 < this.rows) {
          this.addSpring(SHEAR_SPRING, i, idx(cx - 1, ry + 1));
        }

        if (cx + 2 < this.cols) this.addSpring(BEND_SPRING, i, idx(cx + 2, ry));
        if (ry + 2 < this.rows) this.addSpring(BEND_SPRING, i, idx(cx, ry + 2));
      }
    }
  }

  addSpring(type: number, a: number, b: number) {
    const restLen = this.restDistance(a, b);
    this.springs.push(new Spring(type, a, b, restLen));
  }

  restDistance(a: number, b: number) {
    const ax = this.rest[a * 3 + 0];
    const ay = this.rest[a * 3 + 1];
    const az = this.rest[a * 3 + 2];
    const bx = this.rest[b * 3 + 0];
    const by = this.rest[b * 3 + 1];
    const bz = this.rest[b * 3 + 2];
    return Math.hypot(bx - ax, by - ay, bz - az);
  }

  updateSpringRests() {
    for (let i = 0; i < this.springs.length; i++) {
      const s = this.springs[i];
      s.rest = this.restDistance(s.a, s.b);
    }
  }

  setAnchor(x: number, y: number) {
    const dx = x - this.anchorX;
    const dy = y - this.anchorY;
    if (Math.abs(dx) + Math.abs(dy) < 0.1) return false;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      this.rest[i3 + 0] += dx;
      this.rest[i3 + 1] += dy;
      this.X.data[i3 + 0] += dx;
      this.X.data[i3 + 1] += dy;
    }

    this.anchorX = x;
    this.anchorY = y;
    return true;
  }

  setSize(width: number, height: number) {
    if (Math.abs(width - this.width) < 0.5 && Math.abs(height - this.height) < 0.5) return false;
    this.width = width;
    this.height = height;

    for (let i = 0; i < this.count; i++) {
      const u = this.uvs[i * 2 + 0];
      const v = this.uvs[i * 2 + 1];
      const i3 = i * 3;
      const nextX = this.anchorX + u * width;
      const nextY = this.anchorY + v * height;
      const dx = nextX - this.rest[i3 + 0];
      const dy = nextY - this.rest[i3 + 1];
      this.rest[i3 + 0] = nextX;
      this.rest[i3 + 1] = nextY;
      this.X.data[i3 + 0] += dx;
      this.X.data[i3 + 1] += dy;
    }

    this.updateSpringRests();
    return true;
  }

  calcNormals() {
    this.N.init(0, 0, 0);
    const N = this.N.data;
    const X = this.X.data;
    const tris = this.tris;
    for (let i = 0, l = tris.length; i < l; i += 3) {
      const v0i = tris[i + 0] * 3;
      const v1i = tris[i + 1] * 3;
      const v2i = tris[i + 2] * 3;

      const v0x = X[v0i + 0];
      const v0y = X[v0i + 1];
      const v0z = X[v0i + 2];
      const v1x = X[v1i + 0];
      const v1y = X[v1i + 1];
      const v1z = X[v1i + 2];
      const v2x = X[v2i + 0];
      const v2y = X[v2i + 1];
      const v2z = X[v2i + 2];

      const d10x = v1x - v0x;
      const d10y = v1y - v0y;
      const d10z = v1z - v0z;
      const d21x = v2x - v1x;
      const d21y = v2y - v1y;
      const d21z = v2z - v1z;

      const nx = d10y * d21z - d10z * d21y;
      const ny = d10z * d21x - d10x * d21z;
      const nz = d10x * d21y - d10y * d21x;
      N[v0i + 0] += nx;
      N[v0i + 1] += ny;
      N[v0i + 2] += nz;
      N[v1i + 0] += nx;
      N[v1i + 1] += ny;
      N[v1i + 2] += nz;
      N[v2i + 0] += nx;
      N[v2i + 1] += ny;
      N[v2i + 2] += nz;
    }
    for (let i = 0, ii = 0, l = this.N.size; i < l; ++i, ii += 3) {
      const x = N[ii + 0];
      const y = N[ii + 1];
      const z = N[ii + 2];
      const il = 1.0 / Math.sqrt(x * x + y * y + z * z + 1e-9);
      N[ii + 0] = x * il;
      N[ii + 1] = y * il;
      N[ii + 2] = z * il;
    }
  }

  calcForces() {
    if (SIM_OPTIONS.dampAir > 0) {
      this.calcNormals();
    }
    this.dFdX.zero();
    this.dFdV.initDiag(0.0);
    this.F.init(0, SIM_OPTIONS.gravity, 0);

    const F = this.F.data;
    const ext = this.externalForce;
    for (let i = 0, l = this.count * 3; i < l; ++i) {
      F[i] += ext[i];
    }

    if (SIM_OPTIONS.dampAir > 0) {
      const [wx, wy, wz] = this.wind;
      const N = this.N.data;
      const V = this.V.data;
      for (let i = 0, ii = 0, l = this.F.size; i < l; ++i, ii += 3) {
        const nx = N[ii + 0];
        const ny = N[ii + 1];
        const nz = N[ii + 2];
        const vx = V[ii + 0];
        const vy = V[ii + 1];
        const vz = V[ii + 2];
        const vwx = vx - wx;
        const vwy = vy - wy;
        const vwz = vz - wz;
        const vwdn = vwx * nx + vwy * ny + vwz * nz;
        const s = SIM_OPTIONS.dampAir * vwdn;
        F[ii + 0] -= nx * s;
        F[ii + 1] -= ny * s;
        F[ii + 2] -= nz * s;
      }
    }

    for (let i = 0; i < this.springs.length; ++i) {
      this.preSolveSpring(this.springs[i]);
    }
  }

  preSolveSpring(s: Spring) {
    const I00 = 1.0, I01 = 0.0, I02 = 0.0;
    const I10 = 0.0, I11 = 1.0, I12 = 0.0;
    const I20 = 0.0, I21 = 0.0, I22 = 1.0;

    const sa = s.a * 3;
    const sb = s.b * 3;
    const rest = +s.rest;
    const damp = +SIM_OPTIONS.dampSpring;

    const dFdX = this.dFdX.data;
    const dFdV = this.dFdV.data;
    const F = this.F.data;
    const X = this.X.data;
    const V = this.V.data;

    const eX = X[sb + 0] - X[sa + 0];
    const eY = X[sb + 1] - X[sa + 1];
    const eZ = X[sb + 2] - X[sa + 2];

    const length = Math.sqrt(eX * eX + eY * eY + eZ * eZ) + 1e-9;
    const il = 1.0 / length;

    const dx = eX * il;
    const dy = eY * il;
    const dz = eZ * il;
    const velX = V[sb + 0] - V[sa + 0];
    const velY = V[sb + 1] - V[sa + 1];
    const velZ = V[sb + 2] - V[sa + 2];

    const k = +SPRING_CONSTANTS[s.type];
    const velDotDir = velX * dx + velY * dy + velZ * dz;
    const fa = k * (length - rest) + damp * velDotDir;
    const fX = dx * fa;
    const fY = dy * fa;
    const fZ = dz * fa;

    F[sa + 0] += fX; F[sa + 1] += fY; F[sa + 2] += fZ;
    F[sb + 0] -= fX; F[sb + 1] -= fY; F[sb + 2] -= fZ;

    const rl = rest / length < 1.0 ? rest / length : 1.0;
    const dp00 = dx * dx, dp01 = dx * dy, dp02 = dx * dz;
    const dp10 = dx * dy, dp11 = dy * dy, dp12 = dy * dz;
    const dp20 = dx * dz, dp21 = dy * dz, dp22 = dz * dz;

    const dFdXs00 = -k * ((I00 - dp00) * rl - I00);
    const dFdXs01 = -k * ((I01 - dp01) * rl - I01);
    const dFdXs02 = -k * ((I02 - dp02) * rl - I02);
    const dFdXs10 = -k * ((I10 - dp10) * rl - I10);
    const dFdXs11 = -k * ((I11 - dp11) * rl - I11);
    const dFdXs12 = -k * ((I12 - dp12) * rl - I12);
    const dFdXs20 = -k * ((I20 - dp20) * rl - I20);
    const dFdXs21 = -k * ((I21 - dp21) * rl - I21);
    const dFdXs22 = -k * ((I22 - dp22) * rl - I22);

    const m = damp * (velDotDir / Math.max(length, rest));
    const dFdXd00 = (I00 - dp00) * m, dFdXd01 = (I01 - dp01) * m, dFdXd02 = (I02 - dp02) * m;
    const dFdXd10 = (I10 - dp10) * m, dFdXd11 = (I11 - dp11) * m, dFdXd12 = (I12 - dp12) * m;
    const dFdXd20 = (I20 - dp20) * m, dFdXd21 = (I21 - dp21) * m, dFdXd22 = (I22 - dp22) * m;

    const dFdX00 = dFdXs00 + dFdXd00;
    const dFdX01 = dFdXs01 + dFdXd01;
    const dFdX02 = dFdXs02 + dFdXd02;
    const dFdX10 = dFdXs10 + dFdXd10;
    const dFdX11 = dFdXs11 + dFdXd11;
    const dFdX12 = dFdXs12 + dFdXd12;
    const dFdX20 = dFdXs20 + dFdXd20;
    const dFdX21 = dFdXs21 + dFdXd21;
    const dFdX22 = dFdXs22 + dFdXd22;

    const dFdV00 = dp00 * damp, dFdV01 = dp01 * damp, dFdV02 = dp02 * damp;
    const dFdV10 = dp10 * damp, dFdV11 = dp11 * damp, dFdV12 = dp12 * damp;
    const dFdV20 = dp20 * damp, dFdV21 = dp21 * damp, dFdV22 = dp22 * damp;

    const mAA = s.a * 9;
    const mAB = s.iab * 9;
    const mBB = s.b * 9;
    const mBA = s.iba * 9;

    dFdX[mAA + 0] -= dFdX00; dFdX[mAA + 1] -= dFdX01; dFdX[mAA + 2] -= dFdX02;
    dFdX[mAA + 3] -= dFdX10; dFdX[mAA + 4] -= dFdX11; dFdX[mAA + 5] -= dFdX12;
    dFdX[mAA + 6] -= dFdX20; dFdX[mAA + 7] -= dFdX21; dFdX[mAA + 8] -= dFdX22;

    dFdX[mBB + 0] -= dFdX00; dFdX[mBB + 1] -= dFdX01; dFdX[mBB + 2] -= dFdX02;
    dFdX[mBB + 3] -= dFdX10; dFdX[mBB + 4] -= dFdX11; dFdX[mBB + 5] -= dFdX12;
    dFdX[mBB + 6] -= dFdX20; dFdX[mBB + 7] -= dFdX21; dFdX[mBB + 8] -= dFdX22;

    dFdX[mAB + 0] += dFdX00; dFdX[mAB + 1] += dFdX01; dFdX[mAB + 2] += dFdX02;
    dFdX[mAB + 3] += dFdX10; dFdX[mAB + 4] += dFdX11; dFdX[mAB + 5] += dFdX12;
    dFdX[mAB + 6] += dFdX20; dFdX[mAB + 7] += dFdX21; dFdX[mAB + 8] += dFdX22;

    dFdX[mBA + 0] += dFdX00; dFdX[mBA + 1] += dFdX01; dFdX[mBA + 2] += dFdX02;
    dFdX[mBA + 3] += dFdX10; dFdX[mBA + 4] += dFdX11; dFdX[mBA + 5] += dFdX12;
    dFdX[mBA + 6] += dFdX20; dFdX[mBA + 7] += dFdX21; dFdX[mBA + 8] += dFdX22;

    dFdV[mAA + 0] -= dFdV00; dFdV[mAA + 1] -= dFdV01; dFdV[mAA + 2] -= dFdV02;
    dFdV[mAA + 3] -= dFdV10; dFdV[mAA + 4] -= dFdV11; dFdV[mAA + 5] -= dFdV12;
    dFdV[mAA + 6] -= dFdV20; dFdV[mAA + 7] -= dFdV21; dFdV[mAA + 8] -= dFdV22;

    dFdV[mBB + 0] -= dFdV00; dFdV[mBB + 1] -= dFdV01; dFdV[mBB + 2] -= dFdV02;
    dFdV[mBB + 3] -= dFdV10; dFdV[mBB + 4] -= dFdV11; dFdV[mBB + 5] -= dFdV12;
    dFdV[mBB + 6] -= dFdV20; dFdV[mBB + 7] -= dFdV21; dFdV[mBB + 8] -= dFdV22;

    dFdV[mAB + 0] += dFdV00; dFdV[mAB + 1] += dFdV01; dFdV[mAB + 2] += dFdV02;
    dFdV[mAB + 3] += dFdV10; dFdV[mAB + 4] += dFdV11; dFdV[mAB + 5] += dFdV12;
    dFdV[mAB + 6] += dFdV20; dFdV[mAB + 7] += dFdV21; dFdV[mAB + 8] += dFdV22;

    dFdV[mBA + 0] += dFdV00; dFdV[mBA + 1] += dFdV01; dFdV[mBA + 2] += dFdV02;
    dFdV[mBA + 3] += dFdV10; dFdV[mBA + 4] += dFdV11; dFdV[mBA + 5] += dFdV12;
    dFdV[mBA + 6] += dFdV20; dFdV[mBA + 7] += dFdV21; dFdV[mBA + 8] += dFdV22;
  }

  conjGradFilt(Xv: BigVec3D, Am: BigMat3D, Bv: BigVec3D, Sm: BigMat3D) {
    const epsilon = 0.02;
    const loopLim = 100;

    function filter(v: BigVec3D, s: BigMat3D) {
      const size = s.size;
      const V = v.data;
      const S = s.data;
      for (let i = 0, i9 = 0; i < size; ++i, i9 += 9) {
        const r = s.posns[i * 2] * 3;
        const s00 = +S[i9 + 0], s01 = +S[i9 + 1], s02 = +S[i9 + 2];
        const s10 = +S[i9 + 3], s11 = +S[i9 + 4], s12 = +S[i9 + 5];
        const s20 = +S[i9 + 6], s21 = +S[i9 + 7], s22 = +S[i9 + 8];
        const v0 = V[r + 0], v1 = V[r + 1], v2 = V[r + 2];
        V[r + 0] = v0 * s00 + v1 * s10 + v2 * s20;
        V[r + 1] = v0 * s01 + v1 * s11 + v2 * s21;
        V[r + 2] = v0 * s02 + v1 * s12 + v2 * s22;
      }
    }

    const size = Bv.size;
    const size3 = size * 3;
    const q = this.tmpQ;
    const d = this.tmpD;
    const tmp = this.tmpT;
    const r = this.tmpR;
    const X = Xv.data;
    const Q = q.data;
    const D = d.data;
    const B = Bv.data;
    const T = tmp.data;
    const R = r.data;

    for (let i = 0; i < size3; ++i) {
      Q[i] = D[i] = T[i] = R[i] = 0.0;
    }

    mul(tmp, Am, Xv);
    for (let i = 0; i < size3; ++i) {
      R[i] = B[i] - T[i];
    }
    filter(r, Sm);
    d.copy(r);
    let s = dot(r, r);

    const sTarg = s * epsilon * epsilon;
    let loops = 0;
    while (s > sTarg && loops++ < loopLim) {
      mul(q, Am, d);
      filter(q, Sm);
      const a = s / dot(d, q);
      for (let i = 0; i < size3; ++i) {
        X[i] += D[i] * a;
      }
      if ((loops % 50) === 0) {
        mul(tmp, Am, Xv);
        for (let i = 0; i < size3; ++i) {
          R[i] = B[i] - T[i];
        }
        filter(r, Sm);
      } else {
        for (let i = 0; i < size3; ++i) {
          R[i] -= Q[i] * a;
        }
      }
      const lastS = s;
      s = dot(r, r);
      const sr = s / lastS;
      for (let i = 0; i < size3; ++i) {
        D[i] = R[i] + D[i] * sr;
      }
      filter(d, Sm);
    }
    return loops < loopLim;
  }

  simulate(dt: number) {
    if (dt <= 0.0) return;
    dt = +dt;
    this.calcForces();
    const dtSqr = dt * dt;

    const size = this.X.size;
    const size3 = size * 3;

    const B = this.tmpB;
    const dFdXmV = this.tmpdFdXmV;

    this.dV.zero();
    for (let i = 0, ii = 0, l = this.S.size, V = this.V.data; i < l; ++i, ii += 2) {
      const c = this.S.posns[ii + 1] * 3;
      V[c + 0] = 0.0; V[c + 1] = 0.0; V[c + 2] = 0.0;
    }

    this.A.initDiag(1.0);
    for (let i = 0, l = this.A.size * 9, A = this.A.data, dFdV = this.dFdV.data, dFdX = this.dFdX.data; i < l; ++i) {
      A[i] -= dFdV[i] * dt + dFdX[i] * dtSqr;
    }

    mul(dFdXmV, this.dFdX, this.V);

    for (let i = 0, F = this.F.data; i < size3; ++i) {
      B.data[i] = F[i] * dt + dFdXmV.data[i] * dtSqr;
    }

    this.conjGradFilt(this.dV, this.A, B, this.S);

    for (let i = 0, X = this.X.data, V = this.V.data, dV = this.dV.data; i < size3; ++i) {
      V[i] += dV[i];
    }
    for (let i = 0, X = this.X.data, V = this.V.data; i < size3; ++i) {
      X[i] += V[i] * dt;
    }

    for (let i = 0, Sp = this.S.posns, sSize = this.S.size, V = this.V.data; i < sSize; ++i) {
      const ci = Sp[i * 2 + 1] * 3;
      V[ci + 0] = V[ci + 1] = V[ci + 2] = 0.0;
    }

    const avgV2 = dot(this.V, this.V) / (this.X.size * 3);
    this.awake = avgV2 < SIM_OPTIONS.sleepThreshold ? this.awake - 1 : SIM_OPTIONS.sleepCount;
  }
}

export default function BookmarkLinkCloth({
  href = "/",
  side = "left",
  className,
  slug: slugProp,
  heroImgUrl: heroImgUrlProp,
  onHomeToggle,
  homeLabel,
  bookmarkLabel,
  showBookmarkLabel = false,
  printBookmarkLabel = false,
  ariaControls,
  ariaExpanded,
  homeFollowRef,
  homeFollow,
}: BookmarkLinkClothProps) {
  const { loaderDone } = useLoader();
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";

  const [isShown, setIsShown] = useState(false);
  const [overlayEl, setOverlayEl] = useState<HTMLElement | null>(null);
  const [hitPortalEl, setHitPortalEl] = useState<HTMLElement | null>(null);
  const createdOverlayRef = useRef(false);
  const [webglOk, setWebglOk] = useState(true);

  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const innerWrapRef = useRef<HTMLDivElement | null>(null);
  const clothHostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitRef = useRef<HTMLDivElement | null>(null);

  const scrollWindRef = useRef(0);
  const scrollLastRef = useRef({ y: 0, t: 0 });
  const disableScrollWindRef = useRef(false);

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

  const dragRef = useRef({
    active: false,
    index: -1,
    targetX: 0,
    targetY: 0,
    down: false,
    moved: false,
    suppressClick: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    downAt: 0,
    useWindowPointer: false,
    wasDownInside: false,
    lastDownAt: 0,
    lastWasDownInside: false,
    patch: null as null | {
      grabIdx: number;
      idxs: number[];
      offsets: Float32Array;
      weights: Float32Array;
    },
  });
  const windowPointerHandlersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    cancel: (e: PointerEvent) => void;
  } | null>(null);
  const skipClickRef = useRef(false);
  const selectionLockRef = useRef<{
    active: boolean;
    userSelect: string;
    webkitUserSelect: string;
  }>({
    active: false,
    userSelect: "",
    webkitUserSelect: "",
  });

  const resolvedBookmarkLabel = useMemo(() => {
    const raw = bookmarkLabel ?? (isHome ? "Index" : "Home");
    const next = raw.trim();
    return (next || (isHome ? "Index" : "Home")).toUpperCase();
  }, [bookmarkLabel, isHome]);

  const [activeLabel, setActiveLabel] = useState(resolvedBookmarkLabel);
  const [labelSwap, setLabelSwap] = useState(false);
  const labelSwapTimerRef = useRef<number | null>(null);

  const labelTextRef = useRef(resolvedBookmarkLabel);
  const labelFadeRef = useRef({ v: printBookmarkLabel ? 1 : 0 });
  const labelFadeTweenRef = useRef<gsap.core.Tween | null>(null);
  const printBookmarkLabelRef = useRef(printBookmarkLabel);
  const labelTextureDirtyRef = useRef(true);
  const labelTexSizeRef = useRef({ w: 1, h: 1, scale: 1 });
  const labelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const anchorBaseRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const followAnchorRef = useRef({
    valid: false,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const isHomeRef = useRef(isHome);
  const followActiveRef = useRef(false);
  const heightTweenRef = useRef<gsap.core.Tween | null>(null);
  const heightProxyRef = useRef({ value: 0 });
  const heightTargetRef = useRef(0);
  const sizeChangedRef = useRef(false);
  const showSeqRef = useRef(0);
  const shownSeqAnimatedRef = useRef(0);

  useEffect(() => {
    isHomeRef.current = isHome;
  }, [isHome]);

  const followActive = !!(isHome && homeFollow && homeFollowRef?.current);

  useEffect(() => {
    followActiveRef.current = followActive;
    if (!followActive) {
      followAnchorRef.current.valid = false;
    }
  }, [followActive]);

  useEffect(() => {
    if (!followActive) return;
    let raf = 0;
    const el = linkRef.current;
    if (el) gsap.killTweensOf(el, "top");
    const tick = () => {
      const target = homeFollowRef?.current;
      if (el && target) {
        const rect = target.getBoundingClientRect();
        const top = rect.bottom - DRAWER_SEAM_OVERLAP_PX;
        gsap.set(el, { top, y: 0 });

        const base = anchorBaseRef.current;
        let left = base.left;
        let width = base.width;
        let height = base.height;
        if (width <= 0 || height <= 0) {
          const lr = el.getBoundingClientRect();
          left = lr.left;
          width = lr.width;
          height = lr.height;
        }
        followAnchorRef.current = {
          valid: width > 0,
          left,
          top,
          width,
          height: Math.max(1, height),
        };
      }
      raf = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      followAnchorRef.current.valid = false;
      window.cancelAnimationFrame(raf);
    };
  }, [followActive, homeFollowRef]);

  useEffect(() => {
    if (followActive) return;
    const el = linkRef.current;
    if (!el) return;
    gsap.killTweensOf(el, "top");
    gsap.set(el, { top: 0 });
  }, [followActive]);

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
      el.style.zIndex = "10009";
      el.style.willChange = "transform,opacity";
      el.style.transform = "translate3d(0,0,0)";
      el.style.backfaceVisibility = "hidden";
      el.style.webkitBackfaceVisibility = "hidden";
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

  useEffect(() => {
    if (typeof document === "undefined") return;
    setHitPortalEl(document.body);
  }, []);

  useEffect(() => {
    const onShow = () => {
      showSeqRef.current += 1;
      setIsShown(true);
    };
    const onHide = () => setIsShown(false);
    window.addEventListener(APP_EVENTS.UI_BOOKMARK_SHOW, onShow);
    window.addEventListener(APP_EVENTS.UI_BOOKMARK_HIDE, onHide);

    if (loaderDone) {
      showSeqRef.current += 1;
      setIsShown(true);
    }
    else setIsShown(false);

    return () => {
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_SHOW, onShow);
      window.removeEventListener(APP_EVENTS.UI_BOOKMARK_HIDE, onHide);
    };
  }, [loaderDone]);

  useLayoutEffect(() => {
    const height = getTargetBookmarkHeight(isHome);
    const extra = Math.max(0, height - BASE_SHAPE_HEIGHT);
    const link = linkRef.current;
    const host = clothHostRef.current;
    if (host) {
      host.style.setProperty("--bookmark-total", `${height}px`);
      host.style.setProperty("--bookmark-extra", `${extra}px`);
    }
    if (link) {
      link.style.setProperty("--bookmark-total", `${height}px`);
      link.style.setProperty("--bookmark-extra", `${extra}px`);
    }
  }, [isHome]);

  useLayoutEffect(() => {
    if (!isShown) return;
    const showSeq = showSeqRef.current;
    if (showSeq === shownSeqAnimatedRef.current) return;

    let raf = 0;
    let tries = 0;
    const run = () => {
      const inner = innerWrapRef.current;
      if (!inner) {
        if (tries < 6) {
          tries += 1;
          raf = window.requestAnimationFrame(run);
        }
        return;
      }
      shownSeqAnimatedRef.current = showSeq;
      gsap.killTweensOf(inner, "y");
      gsap.set(inner, { y: DROP_INNER_Y, willChange: "transform", force3D: true });
      gsap.to(inner, {
        y: 0,
        duration: 0.6,
        ease: "power2.out",
        overwrite: "auto",
        force3D: true,
        onComplete: () => {
          gsap.set(inner, { willChange: "auto" });
        },
      });
    };
    run();
    return () => window.cancelAnimationFrame(raf);
  }, [isShown]);

  useEffect(() => {
    if (!showBookmarkLabel) return;
    if (resolvedBookmarkLabel === activeLabel) return;
    if (labelSwapTimerRef.current) {
      window.clearTimeout(labelSwapTimerRef.current);
      labelSwapTimerRef.current = null;
    }

    setLabelSwap(true);
    labelSwapTimerRef.current = window.setTimeout(() => {
      setActiveLabel(resolvedBookmarkLabel);
      window.requestAnimationFrame(() => setLabelSwap(false));
      labelSwapTimerRef.current = null;
    }, LABEL_SWAP_OUT_MS);

    return () => {
      if (labelSwapTimerRef.current) {
        window.clearTimeout(labelSwapTimerRef.current);
        labelSwapTimerRef.current = null;
      }
    };
  }, [activeLabel, resolvedBookmarkLabel, showBookmarkLabel]);

  useEffect(() => {
    const wasVisible = printBookmarkLabelRef.current;
    printBookmarkLabelRef.current = printBookmarkLabel;

    if (!printBookmarkLabel) {
      labelFadeTweenRef.current?.kill();
      labelFadeRef.current.v = 0;
      labelTextureDirtyRef.current = true;
      return;
    }

    if (!wasVisible) {
      labelFadeRef.current.v = 1;
      labelTextRef.current = resolvedBookmarkLabel;
      labelTextureDirtyRef.current = true;
    }
  }, [printBookmarkLabel, resolvedBookmarkLabel]);

  useEffect(() => {
    if (!printBookmarkLabel) return;
    if (resolvedBookmarkLabel === labelTextRef.current) return;

    labelFadeTweenRef.current?.kill();
    labelFadeTweenRef.current = gsap.to(labelFadeRef.current, {
      v: 0,
      duration: 0.25,
      ease: "power2.out",
      onUpdate: () => {
        labelTextureDirtyRef.current = true;
      },
      onComplete: () => {
        labelTextRef.current = resolvedBookmarkLabel;
        labelTextureDirtyRef.current = true;
        labelFadeTweenRef.current = gsap.to(labelFadeRef.current, {
          v: 1,
          duration: 0.25,
          ease: "power2.out",
          onUpdate: () => {
            labelTextureDirtyRef.current = true;
          },
        });
      },
    });
  }, [printBookmarkLabel, resolvedBookmarkLabel]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(MOBILE_SCROLL_WIND_QUERY);
    const sync = () => {
      disableScrollWindRef.current = mq.matches;
      scrollWindRef.current = 0;
      scrollLastRef.current = { y: getNativeScrollY(), t: performance.now() };
    };
    sync();

    if (mq.addEventListener) {
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const now = performance.now();
      const y = getNativeScrollY();
      if (disableScrollWindRef.current) {
        scrollWindRef.current = 0;
        scrollLastRef.current = { y, t: now };
        return;
      }
      const lastT = scrollLastRef.current.t || now;
      const dt = clamp((now - lastT) / 1000, 0.008, 0.05);
      const dy = y - scrollLastRef.current.y;
      scrollLastRef.current.y = y;
      scrollLastRef.current.t = now;
      const vy = dy / dt;
      const norm = clamp(vy / SCROLL_WIND_NORM, -SCROLL_WIND_MAX, SCROLL_WIND_MAX);
      scrollWindRef.current = norm;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const updatePointer = useCallback((clientX: number, clientY: number) => {
    const now = performance.now();
    const p = pointerRef.current;
    const dt = p.lastT ? clamp((now - p.lastT) / 1000, 0.008, 0.05) : 0.016;
    const vx = (clientX - p.lastX) / dt;
    const vy = (clientY - p.lastY) / dt;
    p.vx = clamp(vx / 900, -1.5, 1.5);
    p.vy = clamp(vy / 900, -1.5, 1.5);
    p.x = clientX;
    p.y = clientY;
    p.lastX = clientX;
    p.lastY = clientY;
    p.lastT = now;
    if (dragRef.current.down) {
      dragRef.current.targetX = clientX;
      dragRef.current.targetY = clientY;
    }
  }, []);

  const lockSelection = useCallback(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (!body || selectionLockRef.current.active) return;
    selectionLockRef.current.active = true;
    selectionLockRef.current.userSelect = body.style.userSelect || "";
    selectionLockRef.current.webkitUserSelect = (body.style as any).webkitUserSelect || "";
    body.style.userSelect = "none";
    (body.style as any).webkitUserSelect = "none";
  }, []);

  const unlockSelection = useCallback(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (!body || !selectionLockRef.current.active) return;
    body.style.userSelect = selectionLockRef.current.userSelect;
    (body.style as any).webkitUserSelect = selectionLockRef.current.webkitUserSelect;
    selectionLockRef.current.active = false;
  }, []);

  const onPointerEnter = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
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

  const isPointInBookmark = useCallback((clientX: number, clientY: number) => {
    const candidates: Array<DOMRect | null> = [];
    const host = clothHostRef.current;
    if (host) candidates.push(host.getBoundingClientRect());
    const link = linkRef.current;
    if (link) candidates.push(link.getBoundingClientRect());
    const hit = hitRef.current;
    if (hit) candidates.push(hit.getBoundingClientRect());

    for (const r of candidates) {
      if (!r) continue;
      if (r.width <= 0 || r.height <= 0) continue;
      const pad = 10;
      if (
        clientX >= r.left - pad &&
        clientX <= r.right + pad &&
        clientY >= r.top - pad &&
        clientY <= r.bottom + pad
      ) {
        return true;
      }
    }
    return false;
  }, []);

  const handleDragMove = useCallback((pointerId: number) => {
    const drag = dragRef.current;
    if (!drag.down) return;
    if (drag.pointerId !== -1 && pointerId !== drag.pointerId) return;

    const dx = drag.targetX - drag.startX;
    const dy = drag.targetY - drag.startY;
    const dist = Math.hypot(dx, dy);
    if (!drag.moved && dist > GRAB_MOVE_PX) {
      drag.moved = true;
    }

    if (!drag.active && drag.moved) {
      drag.active = true;
    }
  }, []);

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

      drag.down = false;
      drag.pointerId = -1;
      drag.useWindowPointer = false;
      drag.active = false;
      drag.wasDownInside = false;
      drag.patch = null;
      unlockSelection();
      if (drag.lastWasDownInside) {
        window.setTimeout(() => {
          drag.lastWasDownInside = false;
        }, 0);
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
    [detachWindowPointerListeners, unlockSelection]
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

  const doNavigate = useCallback(async () => {
    if (isHome) {
      onHomeToggle?.();
      return;
    }
    if (!href) return;

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
  }, [heroImgUrlProp, href, isHome, onHomeToggle, pathname, router, slugProp]);

  const activateLockRef = useRef(false);

  const handleActivate = useCallback(() => {
    if (activateLockRef.current) return;
    activateLockRef.current = true;
    void doNavigate().finally(() => {
      activateLockRef.current = false;
    });
  }, [doNavigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPointerDownWindow = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!isPointInBookmark(e.clientX, e.clientY)) return;
      if (dragRef.current.down) return;

      pointerRef.current.active = true;
      updatePointer(e.clientX, e.clientY);

      const drag = dragRef.current;
      drag.suppressClick = false;
      drag.down = true;
      drag.moved = false;
      drag.active = false;
      drag.index = -1;
      drag.patch = null;
      drag.wasDownInside = true;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.targetX = e.clientX;
      drag.targetY = e.clientY;
      drag.downAt = performance.now();
      drag.lastDownAt = drag.downAt;
      drag.pointerId = e.pointerId;
      drag.useWindowPointer = true;
      drag.lastWasDownInside = true;
      lockSelection();
    };

    const onPointerMoveWindow = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.down || drag.pointerId !== e.pointerId) return;
      updatePointer(e.clientX, e.clientY);
      handleDragMove(e.pointerId);
    };

    const onPointerUpWindow = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.down || drag.pointerId !== e.pointerId) return;
      const shouldClick = drag.wasDownInside && !drag.active;
      endPointer({ clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId });
      skipClickRef.current = true;
      if (shouldClick) handleActivate();
      window.setTimeout(() => {
        skipClickRef.current = false;
      }, 0);
    };

    const onPointerCancelWindow = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.down || drag.pointerId !== e.pointerId) return;
      endPointer({ clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId });
    };

    window.addEventListener("pointerdown", onPointerDownWindow, { capture: true, passive: true });
    window.addEventListener("pointermove", onPointerMoveWindow, { capture: true, passive: true });
    window.addEventListener("pointerup", onPointerUpWindow, { capture: true, passive: true });
    window.addEventListener("pointercancel", onPointerCancelWindow, {
      capture: true,
      passive: true,
    });

    return () => {
      window.removeEventListener("pointerdown", onPointerDownWindow, true);
      window.removeEventListener("pointermove", onPointerMoveWindow, true);
      window.removeEventListener("pointerup", onPointerUpWindow, true);
      window.removeEventListener("pointercancel", onPointerCancelWindow, true);
    };
  }, [
    endPointer,
    handleActivate,
    handleDragMove,
    isPointInBookmark,
    lockSelection,
    isShown,
    updatePointer,
  ]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;

      const a = linkRef.current;
      if (!a) return;

      pointerRef.current.active = true;
      updatePointer(e.clientX, e.clientY);

      const drag = dragRef.current;
      drag.suppressClick = false;
      drag.down = true;
      drag.moved = false;
      drag.active = false;
      drag.index = -1;
      drag.patch = null;
      drag.wasDownInside = true;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.targetX = e.clientX;
      drag.targetY = e.clientY;
      drag.downAt = performance.now();
      drag.lastDownAt = drag.downAt;
      drag.pointerId = e.pointerId;
      drag.useWindowPointer = false;
      drag.lastWasDownInside = true;
      lockSelection();

      let needsWindowPointer = false;
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

      if (needsWindowPointer) {
        attachWindowPointerListeners();
      }
    },
    [attachWindowPointerListeners, lockSelection, updatePointer]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      updatePointer(e.clientX, e.clientY);
      handleDragMove(e.pointerId);
    },
    [handleDragMove, updatePointer]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      endPointer(e);
    },
    [endPointer]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      endPointer(e);
    },
    [endPointer]
  );

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (skipClickRef.current) {
        skipClickRef.current = false;
        e.preventDefault();
        return;
      }
      if (dragRef.current.active) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      handleActivate();
    },
    [handleActivate]
  );

  const readLabelOffset = useCallback(() => {
    if (typeof window === "undefined") return LABEL_OFFSET_PX;
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
      "--bookmark-label-offset"
    );
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : LABEL_OFFSET_PX;
  }, []);

  const getLabelScale = useCallback(() => {
    if (typeof window === "undefined") return 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return Math.max(1, dpr * LABEL_TEX_SCALE);
  }, []);

  const drawLabelTexture = useCallback(
    (text: string, width: number, height: number, scale: number) => {
      let canvas = labelCanvasRef.current;
      let ctx = labelCtxRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        labelCanvasRef.current = canvas;
      }
      if (!ctx) {
        ctx = canvas.getContext("2d", { willReadFrequently: false }) || null;
        if (!ctx) return null;
        labelCtxRef.current = ctx;
      }
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);

      const label = text?.trim().toUpperCase();
      if (!label) return canvas;

      const fontPx = LABEL_FONT_PX * scale;
      const trackingPx = LABEL_TRACK_EM * fontPx;
      const offsetPx = readLabelOffset() * scale;

      ctx.save();
      ctx.translate(Math.round(width / 2 + LABEL_CENTER_SHIFT_PX * scale), height - offsetPx);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.font = `${LABEL_FONT_WEIGHT} ${fontPx}px ${LABEL_FONT_FAMILY}`;

      let x = 0;
      for (let i = 0; i < label.length; i++) {
        const ch = label[i];
        ctx.fillText(ch, x, 0);
        x += ctx.measureText(ch).width + trackingPx;
      }
      ctx.restore();

      return canvas;
    },
    [readLabelOffset]
  );

  useEffect(() => {
    if (!overlayEl || !isShown) return;
    const canvas = canvasRef.current;
    const host = clothHostRef.current;
    const link = linkRef.current;
    if (!canvas || !host) return;

    const glOpts: WebGLContextAttributes = {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    };

    const gl = (canvas.getContext("webgl", glOpts) ||
      canvas.getContext("experimental-webgl", glOpts) ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) {
      setWebglOk(false);
      return;
    }

    const deriv = gl.getExtension("OES_standard_derivatives");
    const fsHeader = deriv
      ? `#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n`
      : `#define HAS_DERIV 0\n`;

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

    const fs = `
      ${fsHeader}
      precision mediump float;
      varying vec2 v_uv;
      uniform vec3 u_color;
      uniform float u_totalH;
      uniform float u_topH;
      uniform float u_tailH;
      uniform sampler2D u_labelTex;
      uniform vec2 u_labelTexSize;
      uniform float u_labelAlpha;
      uniform vec3 u_labelColor;

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

        vec3 color = u_color;
        if (u_labelAlpha > 0.001) {
          vec2 texel = vec2(1.0) / u_labelTexSize;
          float mask = texture2D(u_labelTex, v_uv).a * u_labelAlpha;
          float hi = texture2D(u_labelTex, v_uv + texel * vec2(-0.8, -0.8)).a * u_labelAlpha;
          float lo = texture2D(u_labelTex, v_uv + texel * vec2(0.8, 0.8)).a * u_labelAlpha;
          float emboss = clamp((hi - lo) * 0.9 + mask * 0.3, -0.6, 0.6);
          color = mix(color, u_labelColor, clamp(mask, 0.0, 1.0));
          color += emboss * 0.16;
        }

        gl_FragColor = vec4(color, alpha);
      }
    `;

    const prog = createProgram(gl, vs, fs);
    if (!prog) {
      setWebglOk(false);
      return;
    }
    setWebglOk(true);
    gl.useProgram(prog);

    const aPos = gl.getAttribLocation(prog, "a_position");
    const aUv = gl.getAttribLocation(prog, "a_uv");
    const uCanvas = gl.getUniformLocation(prog, "u_canvas");
    const uColor = gl.getUniformLocation(prog, "u_color");
    const uTotalH = gl.getUniformLocation(prog, "u_totalH");
    const uTopH = gl.getUniformLocation(prog, "u_topH");
    const uTailH = gl.getUniformLocation(prog, "u_tailH");
    const uLabelTex = gl.getUniformLocation(prog, "u_labelTex");
    const uLabelTexSize = gl.getUniformLocation(prog, "u_labelTexSize");
    const uLabelAlpha = gl.getUniformLocation(prog, "u_labelAlpha");
    const uLabelColor = gl.getUniformLocation(prog, "u_labelColor");

    const posBuf = gl.createBuffer();
    const uvBuf = gl.createBuffer();
    const idxBuf = gl.createBuffer();
    const labelTex = gl.createTexture();
    if (!posBuf || !uvBuf || !idxBuf || !labelTex) return;

    gl.bindTexture(gl.TEXTURE_2D, labelTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    let stripHeight = getTargetBookmarkHeight(isHomeRef.current);
    heightProxyRef.current.value = stripHeight;
    heightTargetRef.current = stripHeight;

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
        canvas.style.width = `${fullW}px`;
        canvas.style.height = `${fullH}px`;
        canvas.style.left = "0px";
        canvas.style.top = "0px";
        gl.viewport(0, 0, w, h);
      }
      gl.useProgram(prog);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uCanvas, fullW, fullH);
      labelTextureDirtyRef.current = true;
    };

    const updateLabelTexture = () => {
      if (!printBookmarkLabel) return;
      const text = labelTextRef.current ?? "";
      const scale = getLabelScale();
      const width = Math.max(1, Math.round(STRIP_W * scale));
      const height = Math.max(1, Math.round(stripHeight * scale));
      const canvas2 = drawLabelTexture(text, width, height, scale);
      if (!canvas2) return;

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, labelTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas2);
      labelTexSizeRef.current = { w: width, h: height, scale };
    };

    const updateHostMetrics = (height: number) => {
      const extra = Math.max(0, height - BASE_SHAPE_HEIGHT);
      host.style.setProperty("--bookmark-total", `${height}px`);
      host.style.setProperty("--bookmark-extra", `${extra}px`);
      if (link) {
        link.style.setProperty("--bookmark-total", `${height}px`);
        link.style.setProperty("--bookmark-extra", `${extra}px`);
      }
    };
    updateHostMetrics(stripHeight);

    const measureAnchorBase = () => {
      let r = host.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) {
        const linkRect = linkRef.current?.getBoundingClientRect();
        if (linkRect) r = linkRect;
      }
      anchorBaseRef.current = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      };
    };
    measureAnchorBase();

    const readAnchor = () => {
      let nextBase = anchorBaseRef.current;
      if (followActiveRef.current && followAnchorRef.current.valid) {
        nextBase = followAnchorRef.current;
      } else {
        // Keep anchor live so first-load drop tween (inner y:-100 -> 0) doesn't freeze cloth too high.
        measureAnchorBase();
        nextBase = anchorBaseRef.current;
      }
      const left = nextBase.left;
      // Drawer offset is already applied by link transform, so don't add it again here.
      const top = nextBase.top;
      const cx = left + nextBase.width / 2;
      return {
        x: cx - STRIP_W / 2,
        y: top,
        rect: { left, top, width: nextBase.width, height: nextBase.height },
      };
    };

    const anchor = readAnchor();
    const cloth = new Cloth(COLS, ROWS, STRIP_W, stripHeight, anchor.x, anchor.y);
    const clampGrabTarget = (grabIdx: number, targetX: number, targetY: number) => {
      const grabCol = grabIdx % cloth.cols;
      const anchorIdx = grabCol;
      const anchorX = cloth.rest[anchorIdx * 3 + 0];
      const anchorY = cloth.rest[anchorIdx * 3 + 1];
      const restLen = Math.hypot(
        cloth.rest[grabIdx * 3 + 0] - anchorX,
        cloth.rest[grabIdx * 3 + 1] - anchorY
      );

      const dx = targetX - anchorX;
      const dy = targetY - anchorY;
      const dist = Math.hypot(dx, dy) || 1;
      const maxLen = Math.max(12, restLen * GRAB_MAX_STRETCH);

      if (dist <= maxLen) {
        return { x: targetX, y: targetY };
      }

      const easedLen = maxLen + (dist - maxLen) * GRAB_OVERDRAG;
      const s = easedLen / dist;
      return {
        x: anchorX + dx * s,
        y: anchorY + dy * s,
      };
    };

    const enforceNoStretch = () => {
      const X = cloth.X.data;
      const V = cloth.V.data;
      const rest = cloth.rest;
      const grabIdx = dragRef.current.active ? dragRef.current.index : -1;
      for (let i = 0; i < cloth.count; i++) {
        if (cloth.isPermanentPinned(i)) continue;
        if (i === grabIdx) continue;
        const i3 = i * 3;
        const col = i % cloth.cols;
        const topIdx = col;
        const t3 = topIdx * 3;

        const anchorX = X[t3 + 0];
        const anchorY = X[t3 + 1];

        const restLen = Math.hypot(rest[i3 + 0] - rest[t3 + 0], rest[i3 + 1] - rest[t3 + 1]);
        if (restLen <= 0.0001) continue;

        const dx = X[i3 + 0] - anchorX;
        const dy = X[i3 + 1] - anchorY;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist <= restLen) continue;

        const s = restLen / dist;
        X[i3 + 0] = anchorX + dx * s;
        X[i3 + 1] = anchorY + dy * s;
        V[i3 + 0] *= 0.12;
        V[i3 + 1] *= 0.12;
      }
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, cloth.uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cloth.tris, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, cloth.X.data, gl.DYNAMIC_DRAW);

    const applyHeight = (nextHeight: number) => {
      stripHeight = nextHeight;
      const sizeChanged = cloth.setSize(STRIP_W, stripHeight);
      if (sizeChanged) {
        sizeChangedRef.current = true;
        updateHostMetrics(stripHeight);
        measureAnchorBase();
        labelTextureDirtyRef.current = true;
      }
    };

    const tweenToHeight = (nextHeight: number, immediate = false) => {
      heightTweenRef.current?.kill();
      if (immediate) {
        heightProxyRef.current.value = nextHeight;
        applyHeight(nextHeight);
        return;
      }
      heightTweenRef.current = gsap.to(heightProxyRef.current, {
        value: nextHeight,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
        onUpdate: () => applyHeight(heightProxyRef.current.value),
      });
    };

    const updateTargetHeight = (immediate = false) => {
      const vh = readViewportHeight();
      const raw = isHomeRef.current ? HOME_ANCHOR_HEIGHT : vh * BOOKMARK_TALL_VH;
      const next = Math.max(BASE_SHAPE_HEIGHT, raw);
      if (Math.abs(next - heightTargetRef.current) < 0.5) return;
      heightTargetRef.current = next;
      tweenToHeight(next, immediate);
    };

    updateTargetHeight(true);

    const handleResize = () => {
      updateTargetHeight(true);
      measureAnchorBase();
      resize();
    };
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);

    let raf = 0;
    let lastT = 0;
    let pinnedGrabIdx = -1;

    const setPinnedGrabIndex = (nextIdx: number) => {
      if (nextIdx === pinnedGrabIdx) return;
      if (pinnedGrabIdx >= 0 && !cloth.isPermanentPinned(pinnedGrabIdx)) {
        cloth.pointStatusSet(pinnedGrabIdx, 0);
      }
      if (nextIdx >= 0 && !cloth.isPermanentPinned(nextIdx)) {
        cloth.pointStatusSet(nextIdx, 1);
      }
      pinnedGrabIdx = nextIdx;
    };

    const step = (time: number) => {
      raf = requestAnimationFrame(step);
      const dt = lastT ? clamp((time - lastT) / 1000, 0.008, 0.033) : SIM_OPTIONS.timeStep;
      lastT = time;

      const { x: nextX, y: nextY, rect: anchorRect } = readAnchor();
      const anchorChanged = cloth.setAnchor(nextX, nextY);
      const hitEl = hitRef.current;
      if (hitEl) {
        const hitHeight = Math.max(stripHeight, BASE_SHAPE_HEIGHT) + HIT_PAD_BOTTOM;
        hitEl.style.transform = `translate3d(${anchorRect.left}px, ${anchorRect.top}px, 0)`;
        hitEl.style.width = `${Math.round(anchorRect.width)}px`;
        hitEl.style.height = `${Math.round(hitHeight)}px`;
      }

      updateTargetHeight();
      const sizeChanged = sizeChangedRef.current;
      sizeChangedRef.current = false;

      const pointer = pointerRef.current;
      const drag = dragRef.current;

      const wind = scrollWindRef.current;
      scrollWindRef.current = lerp(scrollWindRef.current, 0, SCROLL_WIND_SMOOTH);
      if (Math.abs(scrollWindRef.current) < 0.001) scrollWindRef.current = 0;

      const ext = cloth.externalForce;
      const hasWind = Math.abs(wind) > 0.0001;
      const hasPointer = pointer.active && !drag.active;
      const hasDrag = drag.active;
      const forceInput = hasWind || hasPointer || hasDrag;

      if (forceInput) {
        ext.fill(0);
        for (let i = 0; i < cloth.count; i++) {
          if (cloth.isPermanentPinned(i)) continue;
          const t = cloth.rowT[i];
          const i3 = i * 3;
          const x = cloth.X.data[i3 + 0];
          const y = cloth.X.data[i3 + 1];
          let fx = 0;
          let fy = 0;
          if (hasWind) {
            fx += -wind * SCROLL_WIND_STRENGTH * (0.2 + 0.8 * t);
          }
          if (hasPointer) {
            const dx = x - pointer.x;
            const dy = y - pointer.y;
            const r2 = dx * dx + dy * dy;
            const fall = 1 / (1 + r2 / (POINTER_RADIUS * POINTER_RADIUS));
            fx += pointer.vx * POINTER_FORCE * fall * (0.3 + 0.7 * t);
            fy += pointer.vy * POINTER_FORCE * fall * (0.3 + 0.7 * t);
          }
          if (hasDrag) {
            const dx = drag.targetX - x;
            const dy = drag.targetY - y;
            const r2 = dx * dx + dy * dy;
            const fall = 1 / (1 + r2 / (GRAB_RADIUS * GRAB_RADIUS));
            fx += dx * GRAB_FORCE * fall;
            fy += dy * GRAB_FORCE * fall;
          }
          ext[i3 + 0] = fx;
          ext[i3 + 1] = fy;
        }
      } else {
        ext.fill(0);
      }

      if (drag.active) {
        if (drag.index < 0) {
          let best = -1;
          let bestD = 1e9;
          for (let i = 0; i < cloth.count; i++) {
            if (cloth.isPermanentPinned(i)) continue;
            const i3 = i * 3;
            const dx = cloth.X.data[i3 + 0] - drag.targetX;
            const dy = cloth.X.data[i3 + 1] - drag.targetY;
            const d = dx * dx + dy * dy;
            if (d < bestD) {
              bestD = d;
              best = i;
            }
          }
          drag.index = best;
        }

        if (drag.index >= 0) {
          setPinnedGrabIndex(drag.index);
          const clampedTarget = clampGrabTarget(drag.index, drag.targetX, drag.targetY);
          const grabTargetX = drag.targetX;
          const grabTargetY = drag.targetY;
          const patchTargetX = clampedTarget.x;
          const patchTargetY = clampedTarget.y;

          if (!drag.patch) {
            const grabIdx = drag.index;
            const grabCol = grabIdx % cloth.cols;
            const grabRow = Math.floor(grabIdx / cloth.cols);
            const radius = GRAB_PATCH_RADIUS;
            const radiusCell = Math.ceil(radius);
            const r0 = Math.max(0, grabRow - radiusCell);
            const r1 = Math.min(cloth.rows - 1, grabRow + radiusCell);
            const c0 = Math.max(0, grabCol - radiusCell);
            const c1 = Math.min(cloth.cols - 1, grabCol + radiusCell);
            const gi3 = grabIdx * 3;
            const baseX = cloth.rest[gi3 + 0];
            const baseY = cloth.rest[gi3 + 1];

            const idxs: number[] = [];
            const offsets: number[] = [];
            const weights: number[] = [];
            for (let r = r0; r <= r1; r++) {
              for (let c = c0; c <= c1; c++) {
                const ddx = c - grabCol;
                const ddy = r - grabRow;
                const dist = Math.hypot(ddx, ddy);
                if (dist > radius) continue;
                const idx = r * cloth.cols + c;
                if (cloth.isPermanentPinned(idx)) continue;
                const t = radius > 0 ? 1 - dist / radius : 0;
                const w = idx === grabIdx ? 1 : clamp(GRAB_SOFT_STRENGTH * t * t, 0, 1);
                idxs.push(idx);
                const j3 = idx * 3;
                offsets.push(cloth.rest[j3 + 0] - baseX, cloth.rest[j3 + 1] - baseY);
                weights.push(w);
              }
            }
            drag.patch = {
              grabIdx,
              idxs,
              offsets: new Float32Array(offsets),
              weights: new Float32Array(weights),
            };
          }

          if (drag.patch) {
            const { idxs, offsets, weights, grabIdx } = drag.patch;
            for (let i = 0; i < idxs.length; i++) {
              const idx = idxs[i];
              const j3 = idx * 3;
              const ox = offsets[i * 2 + 0];
              const oy = offsets[i * 2 + 1];
              const w = weights[i];
              const targetX = idx === grabIdx ? grabTargetX : patchTargetX + ox;
              const targetY = idx === grabIdx ? grabTargetY : patchTargetY + oy;
              if (idx === grabIdx || w >= 0.999) {
                cloth.X.data[j3 + 0] = targetX;
                cloth.X.data[j3 + 1] = targetY;
                cloth.V.data[j3 + 0] = 0;
                cloth.V.data[j3 + 1] = 0;
              } else {
                cloth.X.data[j3 + 0] = lerp(cloth.X.data[j3 + 0], targetX, w);
                cloth.X.data[j3 + 1] = lerp(cloth.X.data[j3 + 1], targetY, w);
                cloth.V.data[j3 + 0] *= 1 - w;
                cloth.V.data[j3 + 1] *= 1 - w;
              }
            }
          }
        }
      } else {
        setPinnedGrabIndex(-1);
        drag.index = -1;
        drag.patch = null;
      }

      if (forceInput) {
        cloth.awake = SIM_OPTIONS.sleepCount;
      }

      if (cloth.awake > 0 || forceInput) {
        cloth.simulate(dt);
      }

      // Let it keep swinging, but converge to rest faster after release.
      if (!drag.active) {
        const damp = Math.pow(PASSIVE_DAMPING_PER_FRAME, dt / SIM_OPTIONS.timeStep);
        const V = cloth.V.data;
        for (let i = 0; i < cloth.count; i++) {
          if (cloth.isPermanentPinned(i)) continue;
          const i3 = i * 3;
          V[i3 + 0] *= damp;
          V[i3 + 1] *= damp;
          V[i3 + 2] *= damp;
        }
      }

      if (drag.active) {
        enforceNoStretch();
      }

      const needsDraw =
        forceInput || cloth.awake > 0 || anchorChanged || sizeChanged || labelTextureDirtyRef.current;

      if (labelTextureDirtyRef.current) {
        labelTextureDirtyRef.current = false;
        updateLabelTexture();
      }

      if (!needsDraw) return;

      gl.useProgram(prog);
      gl.uniform3f(uColor, BOOKMARK_RED.r, BOOKMARK_RED.g, BOOKMARK_RED.b);
      gl.uniform3f(uLabelColor, TEXT_RED.r, TEXT_RED.g, TEXT_RED.b);
      gl.uniform1f(uTotalH, stripHeight);
      gl.uniform1f(uTopH, BASE_RECT_HEIGHT + Math.max(0, stripHeight - BASE_SHAPE_HEIGHT));
      gl.uniform1f(uTailH, TAIL_HEIGHT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, labelTex);
      gl.uniform1f(uLabelAlpha, printBookmarkLabel ? labelFadeRef.current.v : 0);
      gl.uniform2f(uLabelTexSize, labelTexSizeRef.current.w, labelTexSizeRef.current.h);
      gl.uniform1i(uLabelTex, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, cloth.X.data);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.enableVertexAttribArray(aUv);
      gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.drawElements(gl.TRIANGLES, cloth.tris.length, gl.UNSIGNED_SHORT, 0);
    };

    resize();
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      setPinnedGrabIndex(-1);
      heightTweenRef.current?.kill();
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(uvBuf);
      gl.deleteBuffer(idxBuf);
      gl.deleteTexture(labelTex);
      gl.deleteProgram(prog);
    };
  }, [overlayEl, isShown, drawLabelTexture, getLabelScale, printBookmarkLabel]);

  const ariaLabel = isHome ? homeLabel ?? "Project index" : "Back";
  const defaultBookmarkHeight = isHome
    ? `${HOME_ANCHOR_HEIGHT}px`
    : `${Math.round(BOOKMARK_TALL_VH * 100)}vh`;

  return (
    <>
      {overlayEl
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
              opacity: isShown ? 1 : 0,
              transition: "opacity 150ms ease",
              display: "block",
              willChange: "transform,opacity",
              transform: "translate3d(0,0,0)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          />,
          overlayEl
        )
        : null}
      {hitPortalEl
        ? createPortal(
          <div
            ref={hitRef}
            aria-hidden
            data-bookmark-hit="true"
            onClick={onClick}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              width: "1px",
              height: "1px",
              transform: "translate3d(-9999px,-9999px,0)",
              pointerEvents: isShown ? "auto" : "none",
              cursor: "grab",
              zIndex: 10021,
              background: "transparent",
              userSelect: "none",
              WebkitUserSelect: "none",
              touchAction: "none",
              willChange: "transform",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          />,
          hitPortalEl
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
        style={{
          touchAction: "none",
          opacity: isShown ? 1 : 0,
          pointerEvents: isShown ? "auto" : "none",
          height: `var(--bookmark-total, ${defaultBookmarkHeight})`,
          transform: followActive
            ? "translate3d(0, 0px, 0)"
            : "translate3d(0, var(--bookmark-offset, 0px), 0)",
          willChange: "transform",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
        className={cn(
          "group fixed top-0 z-[10010] overflow-visible origin-top",
          side === "left" ? "left-6" : "right-6",
          "inline-flex items-start justify-center",
          "w-12",
          "select-none [-webkit-user-drag:none]",
          "cursor-grab active:cursor-grabbing",
          className
        )}
      >
        <div
          ref={innerWrapRef}
          className="relative h-full w-full pointer-events-none will-change-transform [transform:translate3d(0,0,0)]"
        >
          <div
            ref={clothHostRef}
            className="absolute left-1/2 top-0 w-12 -translate-x-1/2 pointer-events-none will-change-transform [transform:translate3d(0,0,0)]"
            style={{ height: `var(--bookmark-total, ${defaultBookmarkHeight})` }}
          >
            {!webglOk ? (
              <div
                aria-hidden
                className="absolute inset-0 rounded-[1px]"
                style={{
                  background: BOOKMARK_RED_HEX,
                  clipPath:
                    "polygon(0 0, 100% 0, 100% calc(100% - 18px), 50% 100%, 0 calc(100% - 18px))",
                  opacity: isShown ? 1 : 0,
                }}
              />
            ) : null}
            {showBookmarkLabel ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2"
                style={{ bottom: "var(--bookmark-label-offset, 14px)" }}
              >
                <div className="relative -translate-x-1/2 rotate-[-90deg] origin-bottom-left">
                  <span
                    className={cn(
                      "block text-[11px] uppercase font-serif tracking-[0.3em] leading-none transition-opacity duration-300",
                      labelSwap ? "opacity-0" : "opacity-100"
                    )}
                    style={{
                      color: TEXT_RED_HEX,
                      textShadow:
                        "-0.6px -0.6px 0 rgba(255,255,255,0.5), 0.6px 0.6px 0 rgba(0,0,0,0.28)",
                    }}
                  >
                    {activeLabel}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </a>
    </>
  );
}
