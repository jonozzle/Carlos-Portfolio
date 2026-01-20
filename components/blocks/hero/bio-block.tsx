// components/blocks/hero/bio-block.tsx
"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { PortableText } from "@portabletext/react";
import clsx from "clsx";
import UnderlineLink from "@/components/ui/underline-link";

type HeroLink = {
  _key?: string;
  label?: string | null;
  href?: string | null;
  newTab?: boolean | null;
};

type BioBlockProps = {
  name?: string; // e.g. "Carlos Castrosin"
  text?: string; // fallback if no PortableText body is provided
  body?: any[] | null; // Sanity PortableText
  dropCap?: boolean | null;
  links?: HeroLink[] | null; // separate link list under the body
  interaction?: "hover" | "click"; // hover for desktop, click for mobile
};

type StyleCfg = {
  tag: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote";
  className: string;
  lh: number;
  capTop: string;
  capTrimEm: number;
};

function cfgForStyle(styleKey: string): StyleCfg {
  switch (styleKey) {
    case "h1":
      return { tag: "h1", className: "text-3xl leading-[1.05]", lh: 1.05, capTop: "0.04em", capTrimEm: 0.22 };
    case "h2":
      return { tag: "h2", className: "text-2xl leading-[1.08]", lh: 1.08, capTop: "0.045em", capTrimEm: 0.23 };
    case "h3":
      return { tag: "h3", className: "text-xl leading-[1.12]", lh: 1.12, capTop: "0.05em", capTrimEm: 0.24 };
    case "h4":
      return { tag: "h4", className: "text-lg leading-[1.18]", lh: 1.18, capTop: "0.055em", capTrimEm: 0.26 };
    case "h5":
      return { tag: "h5", className: "text-base leading-[1.22]", lh: 1.22, capTop: "0.06em", capTrimEm: 0.27 };
    case "h6":
      return { tag: "h6", className: "text-sm leading-[1.26]", lh: 1.26, capTop: "0.065em", capTrimEm: 0.28 };
    case "blockquote":
      return { tag: "blockquote", className: "text-sm italic leading-[1.4]", lh: 1.4, capTop: "0.07em", capTrimEm: 0.3 };
    case "normal":
    default:
      return { tag: "p", className: "text-sm leading-snug", lh: 1.35, capTop: "0.07em", capTrimEm: 0.3 };
  }
}

function sanitizeHref(href: unknown) {
  const h = typeof href === "string" ? href.trim() : "";
  return h || null;
}

function isLikelyExternal(href: string) {
  const h = (href ?? "").trim();
  return h.startsWith("http://") || h.startsWith("https://");
}

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
function unionRect(a: DOMRect, b: DOMRect): Rect {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.right, b.right);
  const bottom = Math.max(a.bottom, b.bottom);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}
function rectCenter(r: Rect | DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export default function BioBlock({
  name = "Carlos Castrosin",
  text = "Carlos is a photographer driven by curiosity for bold commercial ideas. He blends clean composition with conceptual thinking, creating images that feel sharp and contemporary.",
  body = null,
  dropCap = false,
  links = null,
  interaction = "hover",
}: BioBlockProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const nameRowRef = useRef<HTMLDivElement | null>(null);
  const bigCRef = useRef<HTMLSpanElement | null>(null);
  const smallCRef = useRef<HTMLSpanElement | null>(null);
  const restFirstRef = useRef<HTMLSpanElement | null>(null);
  const restSecondRef = useRef<HTMLSpanElement | null>(null);
  const bioRef = useRef<HTMLDivElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const [firstWord = "", secondWord = ""] = name.split(" ");
  const firstC = firstWord.charAt(0) || "C";
  const restFirst = firstWord.slice(1);
  const secondC = secondWord.charAt(0) || "C";
  const restSecond = secondWord.slice(1);

  const firstBlockKey = useMemo(() => {
    if (!dropCap) return null;
    if (!Array.isArray(body)) return null;
    const first = body.find((b) => b && b._type === "block" && typeof b._key === "string");
    return first?._key ?? null;
  }, [dropCap, body]);

  const ptComponents = useMemo(() => {
    return {
      marks: {
        strong: (p: any) => <strong className="font-bold">{p.children}</strong>,
        em: (p: any) => <em className="italic">{p.children}</em>,
        link: (p: any) => {
          const href = sanitizeHref(p?.value?.href);
          if (!href) return <>{p.children}</>;

          const external = isLikelyExternal(href);
          return (
            <UnderlineLink
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              hoverUnderline
              data-cursor="link"
              className="opacity-90 hover:opacity-100"
            >
              {p.children}
            </UnderlineLink>
          );
        },
      },
      block: (p: any) => {
        const styleKey = p?.value?.style || "normal";
        const isFirst = !!dropCap && !!firstBlockKey && p?.value?._key === firstBlockKey;

        const cfg = cfgForStyle(styleKey);
        const Tag = cfg.tag as any;

        const className = clsx(
          "it-pt-block font-sans tracking-tighter max-w-[33ch] text-left",
          cfg.className,
          isFirst && "it-dropcap-target"
        );

        const styleVars = isFirst
          ? ({
            ["--lh" as any]: String(cfg.lh),
            ["--cap-top" as any]: cfg.capTop,
            ["--cap-trim" as any]: String(cfg.capTrimEm),
            ["--cap-lines" as any]: "2",
          } as React.CSSProperties)
          : undefined;

        return (
          <Tag className={className} style={styleVars}>
            {p.children}
          </Tag>
        );
      },
    };
  }, [dropCap, firstBlockKey]);

  const safeLinks = useMemo(() => {
    const raw = (links ?? []) as unknown[];
    return raw
      .filter((l): l is HeroLink => !!l && typeof l === "object")
      .map((l, idx) => {
        const label = (l.label ?? "").trim();
        const href = sanitizeHref(l.href);
        return {
          key: l._key ?? `${label}-${href ?? ""}-${idx}`,
          label,
          href,
          newTab: !!l.newTab,
        };
      })
      .filter((l) => !!l.label && !!l.href);
  }, [links]);

  const useClick = interaction === "click";
  const hasBody = Array.isArray(body) && body.length > 0;

  useGSAP(
    () => {
      const box = boxRef.current;
      const inner = innerRef.current;
      const nameRow = nameRowRef.current;
      const bigCEl = bigCRef.current;
      const smallCEl = smallCRef.current;
      const restFirstEl = restFirstRef.current;
      const restSecondEl = restSecondRef.current;
      const bioEl = bioRef.current;

      if (!box || !inner || !nameRow || !bigCEl || !smallCEl || !restFirstEl || !restSecondEl || !bioEl) return;

      const SQUARE_SIZE = 64; // closed square
      const EXPANDED_WIDTH = SQUARE_SIZE + 220;
      const EXPANDED_MIN_HEIGHT = SQUARE_SIZE + 110;

      // CLOSED small-c pose (relative to big C center)
      const SMALL_C_CLOSED = {
        scale: 0.72,
        relX: -6, // px from big C center to small C center
        relY: 0, // px from big C center to small C center
        rotation: -185, // deg
      };

      const build = (opts?: { keepProgress?: boolean; prevProgress?: number; prevReversed?: boolean; prevActive?: boolean }) => {
        // kill any existing timeline
        if (tlRef.current) {
          tlRef.current.kill();
          tlRef.current = null;
        }

        // Hide while we set up to avoid flashes
        gsap.set(box, { autoAlpha: 0 });

        // Clear/normalize any prior inline props that might linger between rebuilds
        gsap.set([bigCEl, smallCEl, restFirstEl, restSecondEl, bioEl], { clearProps: "transform" });

        // Measure inner content for expanded height
        gsap.set(inner, { width: EXPANDED_WIDTH, height: "auto" });
        const measuredHeight = Math.ceil(inner.getBoundingClientRect().height);
        const expandedHeight = Math.max(EXPANDED_MIN_HEIGHT, measuredHeight);
        gsap.set(inner, { height: expandedHeight });

        // Outer box: animates from square to expanded
        gsap.set(box, { width: SQUARE_SIZE, height: SQUARE_SIZE });

        // Name row base state
        gsap.set(nameRow, { y: 0 });

        // Reset Cs
        gsap.set(bigCEl, {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          transformOrigin: "50% 50%",
        });

        gsap.set(smallCEl, {
          x: 0,
          y: 0,
          rotation: 0,
          scale: SMALL_C_CLOSED.scale,
          transformOrigin: "50% 50%",
        });

        // Non-C letters hidden (no layout changes)
        gsap.set(restFirstEl, { opacity: 0, x: 4, clipPath: "inset(0 100% 0 0)" });
        gsap.set(restSecondEl, { opacity: 0, x: 4, clipPath: "inset(0 100% 0 0)" });

        // Bio hidden
        gsap.set(bioEl, { opacity: 0, y: 8 });

        // --- CLOSED STATE: center combined bounds of the two Cs in the square ---
        const boxRect = box.getBoundingClientRect();
        const squareCenter = { x: boxRect.left + SQUARE_SIZE / 2, y: boxRect.top + SQUARE_SIZE / 2 };

        // Pose small C relative to big C center
        const bigBase = bigCEl.getBoundingClientRect();
        const smallBase = smallCEl.getBoundingClientRect();

        const bigBaseCenter = rectCenter(bigBase);
        const smallBaseCenter = rectCenter(smallBase);

        const desiredSmallCenter = {
          x: bigBaseCenter.x + SMALL_C_CLOSED.relX,
          y: bigBaseCenter.y + SMALL_C_CLOSED.relY,
        };

        const smallPoseDx = desiredSmallCenter.x - smallBaseCenter.x;
        const smallPoseDy = desiredSmallCenter.y - smallBaseCenter.y;

        gsap.set(smallCEl, {
          x: smallPoseDx,
          y: smallPoseDy,
          rotation: SMALL_C_CLOSED.rotation,
          scale: SMALL_C_CLOSED.scale,
        });

        // Measure combined bounds AFTER pose; then shift both as a group into square center
        const bigPosed = bigCEl.getBoundingClientRect();
        const smallPosed = smallCEl.getBoundingClientRect();
        const combined = unionRect(bigPosed, smallPosed);
        const combinedCenter = rectCenter(combined);

        const groupDx = squareCenter.x - combinedCenter.x;
        const groupDy = squareCenter.y - combinedCenter.y;

        gsap.set(bigCEl, { x: groupDx, y: groupDy, rotation: 0, scale: 1 });
        gsap.set(smallCEl, {
          x: smallPoseDx + groupDx,
          y: smallPoseDy + groupDy,
          rotation: SMALL_C_CLOSED.rotation,
          scale: SMALL_C_CLOSED.scale,
        });

        // Reveal box after setup
        gsap.set(box, { autoAlpha: 1 });

        const tl = gsap.timeline({ paused: true });

        tl.to(
          box,
          {
            width: EXPANDED_WIDTH,
            height: expandedHeight,
            duration: 1.4,
            ease: "power2.inOut",
          },
          0
        )
          .to(
            bigCEl,
            {
              x: 0,
              y: 0,
              rotation: 0,
              scale: 1,
              duration: 1.4,
              ease: "power3.out",
            },
            0
          )
          .to(
            smallCEl,
            {
              x: 0,
              y: 0,
              rotation: 0,
              scale: 1,
              duration: 1.4,
              ease: "power3.out",
            },
            0
          )
          .to(
            [restFirstEl, restSecondEl],
            {
              opacity: 1,
              x: 0,
              clipPath: "inset(0 0% 0 0)",
              duration: 0.8,
              ease: "power2.out",
              stagger: 0.05,
            },
            0.1
          )
          .to(
            bioEl,
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: "power2.out",
            },
            0.2
          );

        tlRef.current = tl;

        // Restore state after rebuild
        if (useClick) {
          tl.progress(isOpenRef.current ? 1 : 0).pause();
        } else if (opts?.keepProgress) {
          const p = typeof opts.prevProgress === "number" ? opts.prevProgress : 0;
          tl.progress(p).pause();

          // If it was actively animating pre-resize, continue in the same direction.
          if (opts.prevActive) {
            if (opts.prevReversed) tl.reverse();
            else tl.play();
          }
        } else {
          tl.progress(0).pause();
        }
      };

      // Initial build
      build({ keepProgress: false });

      // Live-resize rebuild (debounced)
      let t: number | null = null;
      let raf: number | null = null;

      const onResize = () => {
        const prev = tlRef.current;
        const prevProgress = prev ? prev.progress() : 0;
        const prevReversed = prev ? prev.reversed() : true;
        const prevActive = prev ? prev.isActive() : false;

        if (t) window.clearTimeout(t);
        t = window.setTimeout(() => {
          if (raf) cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            // keep hover-progress; click-mode is derived from isOpenRef
            build({ keepProgress: !useClick, prevProgress, prevReversed, prevActive });
          });
        }, 120);
      };

      window.addEventListener("resize", onResize, { passive: true });
      window.addEventListener("orientationchange", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("orientationchange", onResize);
        if (t) window.clearTimeout(t);
        if (raf) cancelAnimationFrame(raf);
        if (tlRef.current) {
          tlRef.current.kill();
          tlRef.current = null;
        }
      };
    },
    { scope: rootRef }
  );

  useEffect(() => {
    if (!useClick) return;
    if (!tlRef.current) return;
    if (isOpen) tlRef.current.play();
    else tlRef.current.reverse();
  }, [isOpen, useClick]);

  const handleEnter = () => {
    if (useClick) return;
    tlRef.current?.play();
  };

  const handleLeave = () => {
    if (useClick) return;
    tlRef.current?.reverse();
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!useClick) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("a")) return;
    setIsOpen((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!useClick) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    setIsOpen((prev) => !prev);
  };

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      className="inline-block cursor-pointer transform-gpu"
      data-cursor="link"
      aria-expanded={useClick ? isOpen : undefined}
      onMouseEnter={useClick ? undefined : handleEnter}
      onMouseLeave={useClick ? undefined : handleLeave}
      onFocus={useClick ? undefined : handleEnter}
      onBlur={useClick ? undefined : handleLeave}
      onClick={useClick ? handleClick : undefined}
      onKeyDown={useClick ? handleKeyDown : undefined}
    >
      <div
        ref={boxRef}
        className="relative bg-red-500 text-white overflow-hidden inline-block transform-gpu"
        style={{ contain: "layout paint" }}
      >
        {/* Inner is always "expanded"; outer clips it when closed */}
        <div ref={innerRef} className="relative w-full h-full">
          {/* Name row – fixed vertical band at the top */}
          <div
            ref={nameRowRef}
            className="absolute left-0 right-0 top-0 h-[64px] flex items-center px-3 pointer-events-none transform-gpu"
          >
            <div className="flex flex-wrap items-baseline gap-x-0 relative">
              {/* C of Carlos */}
              <span ref={bigCRef} className="font-serif text-[36px] leading-none inline-block">
                {firstC}
              </span>

              {/* "arlos" */}
              <span
                ref={restFirstRef}
                className="font-serif text-[27px] leading-none tracking-tight inline-block ml-0"
              >
                {restFirst}
              </span>

              {/* C of Castrosin */}
              <span ref={smallCRef} className="font-serif text-[36px] leading-none inline-block ml-3">
                {secondC}
              </span>

              {/* "astrosin" */}
              <span
                ref={restSecondRef}
                className="font-serif text-[27px] leading-none tracking-tight inline-block ml-0"
              >
                {restSecond}
              </span>
            </div>
          </div>

          {/* Bio copy – revealed once expanded, sits under the 64px title band */}
          <div className="px-3 pb-4 pt-16">
            <div ref={bioRef} className="pointer-events-auto">
              {hasBody ? (
                <div className={clsx("it-pt")}>
                  <PortableText value={body as any} components={ptComponents as any} />
                </div>
              ) : (
                <p className="text-sm tracking-normal mb-3 font-sans max-w-[33ch] leading-snug text-left">{text}</p>
              )}

              {safeLinks.length ? (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {safeLinks.map((l) => {
                    const external = isLikelyExternal(l.href!);
                    const target = l.newTab || external ? "_blank" : undefined;
                    const rel = target ? "noreferrer" : undefined;

                    return (
                      <UnderlineLink
                        key={l.key}
                        href={l.href!}
                        target={target}
                        rel={rel}
                        hoverUnderline
                        data-cursor="link"
                        className="opacity-90 hover:opacity-100"
                      >
                        {l.label}
                      </UnderlineLink>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
