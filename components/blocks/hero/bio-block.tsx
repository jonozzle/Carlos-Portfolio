// components/blocks/hero/bio-block.tsx
"use client";

import type React from "react";
import { useMemo, useRef } from "react";
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

export default function BioBlock({
  name = "Carlos Castrosin",
  text = "Carlos is a photographer driven by curiosity for bold commercial ideas. He blends clean composition with conceptual thinking, creating images that feel sharp and contemporary.",
  body = null,
  dropCap = false,
  links = null,
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

  useGSAP(
    () => {
      const box = boxRef.current;
      const inner = innerRef.current;
      const nameRow = nameRowRef.current;
      const bigC = bigCRef.current;
      const smallC = smallCRef.current;
      const restFirstEl = restFirstRef.current;
      const restSecondEl = restSecondRef.current;
      const bio = bioRef.current;

      if (!box || !inner || !nameRow || !bigC || !smallC || !restFirstEl || !restSecondEl || !bio) {
        return;
      }

      const SQUARE_SIZE = 64; // closed square
      const EXPANDED_WIDTH = SQUARE_SIZE + 220;
      const EXPANDED_HEIGHT = SQUARE_SIZE + 110;

      // CLOSED small-c manual offsets
      const SMALL_C_OFFSET_X = -3; // tweak as needed
      const SMALL_C_OFFSET_Y = 4; // tweak as needed

      // Hide while we set up to avoid flashes
      gsap.set(box, { autoAlpha: 0 });

      // Outer box: animates from square to expanded
      gsap.set(box, {
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
      });

      // Inner content: always final size so layout is stable
      gsap.set(inner, {
        width: EXPANDED_WIDTH,
        height: EXPANDED_HEIGHT,
      });

      // Name row base state (fixed band at the top)
      gsap.set(nameRow, { y: 0 });

      // Reset Cs before measuring
      gsap.set([bigC, smallC], {
        x: 0,
        y: 0,
        rotation: 0,
        transformOrigin: "50% 50%",
      });

      // Non-C letters: in place but visually hidden (no layout changes)
      gsap.set(restFirstEl, {
        opacity: 0,
        x: 4,
        clipPath: "inset(0 100% 0 0)",
      });

      gsap.set(restSecondEl, {
        opacity: 0,
        x: 4,
        clipPath: "inset(0 100% 0 0)",
      });

      // Bio hidden
      gsap.set(bio, { opacity: 0, y: 8 });

      // Measure for centering the Cs in the closed square
      const boxRect = box.getBoundingClientRect();
      const bigRect = bigC.getBoundingClientRect();
      const smallRect = smallC.getBoundingClientRect();

      const centerX = boxRect.left + SQUARE_SIZE / 2;
      const centerY = boxRect.top + SQUARE_SIZE / 2;

      const bigCenterX = bigRect.left + bigRect.width / 2;
      const bigCenterY = bigRect.top + bigRect.height / 2;
      const smallCenterX = smallRect.left + smallRect.width / 2;
      const smallCenterY = smallRect.top + smallRect.height / 2;

      const bigDx = centerX - bigCenterX;
      const bigDy = centerY - bigCenterY;
      const smallDx = centerX - smallCenterX;
      const smallDy = centerY - smallCenterY;

      // CLOSED: both Cs stacked in the middle of the square
      gsap.set(bigC, {
        x: bigDx,
        y: bigDy,
        rotation: 0,
      });

      // CLOSED: small C with manual pixel offsets
      gsap.set(smallC, {
        x: smallDx + SMALL_C_OFFSET_X,
        y: smallDy + SMALL_C_OFFSET_Y,
        rotation: -185,
      });

      // Reveal box after setup
      gsap.set(box, { autoAlpha: 1 });

      const tl = gsap.timeline({ paused: true });

      tl.to(
        box,
        {
          width: EXPANDED_WIDTH,
          height: EXPANDED_HEIGHT,
          duration: 1.4,
          ease: "power2.inOut",
        },
        0
      )
        // Cs move from stacked center (with offsets) to inline positions
        .to(
          bigC,
          {
            x: 0,
            y: 0,
            rotation: 0,
            duration: 1.4,
            ease: "power3.out",
          },
          0
        )
        .to(
          smallC,
          {
            x: 0,
            y: 0,
            rotation: 0,
            duration: 1.4,
            ease: "power3.out",
          },
          0
        )
        // Reveal rest of the letters (no reflow, just opacity/clip)
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
        // Reveal bio
        .to(
          bio,
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power2.out",
          },
          0.2
        );

      tlRef.current = tl;

      return () => {
        tl.kill();
      };
    },
    { scope: rootRef }
  );

  const handleEnter = () => tlRef.current?.play();
  const handleLeave = () => tlRef.current?.reverse();

  const hasBody = Array.isArray(body) && body.length > 0;

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      className="inline-block cursor-pointer transform-gpu"
      data-cursor="link"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
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
            <div className="flex flex-wrap items-baseline gap-x-1 relative">
              {/* C of Carlos */}
              <span ref={bigCRef} className="font-serif text-4xl leading-none inline-block">
                {firstC}
              </span>

              {/* "arlos" */}
              <span
                ref={restFirstRef}
                className="text-base tracking-tight font-serif leading-none inline-block"
              >
                {restFirst}
              </span>

              {/* C of Castrosin */}
              <span
                ref={smallCRef}
                className="font-serif lowercase text-4xl leading-none inline-block"
              >
                {secondC}
              </span>

              {/* "astrosin" */}
              <span
                ref={restSecondRef}
                className="text-base tracking-tight font-serif leading-none inline-block"
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
                <p className="text-sm tracking-tighter font-sans max-w-[33ch] leading-snug text-left">
                  {text}
                </p>
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
