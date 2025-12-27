// components/blocks/hero/bio-block.tsx
"use client";

import type React from "react";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

type BioBlockProps = {
  name?: string; // e.g. "Carlos Castrosin"
  text?: string;
};

export default function BioBlock({
  name = "Carlos Castrosin",
  text = "Carlos is a photographer driven by curiosity for bold commercial ideas. He blends clean composition with conceptual thinking, creating images that feel sharp and contemporary.",
}: BioBlockProps) {
  const rootRef = useRef<HTMLButtonElement | null>(null);
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

      if (
        !box ||
        !inner ||
        !nameRow ||
        !bigC ||
        !smallC ||
        !restFirstEl ||
        !restSecondEl ||
        !bio
      ) {
        return;
      }

      const SQUARE_SIZE = 64; // closed square
      const EXPANDED_WIDTH = SQUARE_SIZE + 220;
      const EXPANDED_HEIGHT = SQUARE_SIZE + 110;

      // CLOSED small-c manual offsets
      const SMALL_C_OFFSET_X = -3; // tweak as needed
      const SMALL_C_OFFSET_Y = 4;  // tweak as needed

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

  return (
    <button
      ref={rootRef}
      type="button"
      className="inline-block cursor-pointer will-change-transform transform-gpu"
      data-cursor="link"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div
        ref={boxRef}
        className="
          relative
          bg-red-500
          text-white
          overflow-hidden
          inline-block
          will-change-transform transform-gpu
        "
      >
        {/* Inner is always "expanded"; outer clips it when closed */}
        <div ref={innerRef} className="relative w-full h-full">
          {/* Name row – fixed vertical band at the top */}
          <div
            ref={nameRowRef}
            className="
              absolute left-0 right-0 top-0
              h-[64px]
              flex items-center
              px-3
              pointer-events-nonewill-change-transform transform-gpu
            "
          >
            <div className="flex flex-wrap items-baseline gap-x-1 relative">
              {/* C of Carlos */}
              <span
                ref={bigCRef}
                className="font-serif text-4xl leading-none inline-block"
              >
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
            <div ref={bioRef}>
              <p className="text-sm tracking-tighter font-sans max-w-[33ch] leading-snug text-left">
                {text}
              </p>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
