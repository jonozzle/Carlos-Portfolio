// components/home-loader.tsx
"use client";

import { useRef, useState, useEffect } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useLoader } from "@/components/loader/loader-context";

const IMAGE_CORNERS = ["0% 0%", "100% 0%", "0% 100%"];

export default function HomeLoader({ enable = true }: { enable?: boolean }) {
  const label = "Carlos Castrosin";
  const { setLoaderDone } = useLoader();

  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const imagesRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  // If loader is disabled, immediately hide and mark as done.
  useEffect(() => {
    if (!enable) {
      setDone(true);
      setLoaderDone(true);
    }
  }, [enable, setLoaderDone]);

  useGSAP(
    () => {
      if (!enable) return; // do nothing
      const root = rootRef.current;
      const imagesWrapper = imagesRef.current;
      const labelEl = labelRef.current;
      if (!root || !imagesWrapper || !labelEl) return;

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const markDone = () => {
        setDone(true);
        setLoaderDone(true);
      };

      if (reduced) {
        gsap.set(root, { autoAlpha: 0 });
        markDone();
        return;
      }

      const layers = imagesWrapper.querySelectorAll<HTMLElement>("[data-loader-image]");
      const letters = labelEl.querySelectorAll<HTMLElement>("[data-letter]");
      if (!layers.length || !letters.length) {
        gsap.set(root, { autoAlpha: 0 });
        markDone();
        return;
      }

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: markDone,
      });

      gsap.set(root, { autoAlpha: 1 });

      layers.forEach((layer, index) => {
        const block = layer.querySelector<HTMLElement>("[data-mask]");
        if (!block) return;
        gsap.set(block, {
          scaleX: 0,
          scaleY: 0,
          opacity: 0,
          transformOrigin: IMAGE_CORNERS[index % IMAGE_CORNERS.length],
        });
      });

      gsap.set(letters, { opacity: 0, y: 40 });

      layers.forEach((layer, index) => {
        const block = layer.querySelector<HTMLElement>("[data-mask]");
        if (!block) return;
        const corner = IMAGE_CORNERS[index % IMAGE_CORNERS.length];

        tl.to(
          block,
          {
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            transformOrigin: corner,
            duration: 0.7,
          },
          index === 0 ? 0 : ">-0.25"
        );
      });

      tl.to(
        letters,
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.03,
        },
        "+=0.2"
      );

      tl.to(
        letters,
        {
          opacity: 0,
          y: -40,
          duration: 0.5,
          ease: "power3.in",
          stagger: 0.02,
        },
        "+=0.6"
      );

      tl.to(
        root,
        {
          autoAlpha: 0,
          duration: 0.7,
          ease: "power2.inOut",
        },
        "-=0.1"
      );

      return () => tl.kill();
    },
    { scope: rootRef, dependencies: [label, enable, setLoaderDone] }
  );

  if (!enable) return null;
  if (done) return null;

  // existing JSX unchanged…
  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[9999] bg-white flex items-center justify-center"
    >
      <div className="flex flex-col items-center gap-8">
        {/* COLOURED STACK (NO RADIUS) */}
        <div
          ref={imagesRef}
          className="relative w-[150px] h-[220px]"
          aria-hidden="true"
        >
          <div data-loader-image className="absolute inset-0 overflow-hidden">
            <div
              data-mask
              className="w-full h-full bg-red-400 opacity-0 scale-0"
            />
          </div>

          <div data-loader-image className="absolute inset-0 overflow-hidden">
            <div
              data-mask
              className="w-full h-full bg-blue-400 opacity-0 scale-0"
            />
          </div>

          <div data-loader-image className="absolute inset-0 overflow-hidden">
            <div
              data-mask
              className="w-full h-full bg-green-400 opacity-0 scale-0"
            />
          </div>
        </div>

        {/* LABEL */}
        <span ref={labelRef} aria-label={label} className="text-black">
          {label
            .trim()
            .split(/\s+/)
            .map((word, wordIndex) => {
              if (!word.length) return null;
              const letters = Array.from(word);

              return (
                <span
                  key={wordIndex}
                  className="inline-block mr-2 align-baseline"
                >
                  {letters.map((char, charIndex) => {
                    const isFirstLetter = charIndex === 0;

                    return (
                      <span
                        key={charIndex}
                        className="inline-block leading-none text-4xl font-serif font-normal transition-transform duration-250 ease-out hover:-translate-y-5"
                      >
                        <span
                          data-letter
                          className={[
                            "inline-block opacity-0",
                            isFirstLetter ? "text-[1.4em]" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {char}
                        </span>
                      </span>
                    );
                  })}
                </span>
              );
            })}
        </span>
      </div>
    </div>
  );
}
