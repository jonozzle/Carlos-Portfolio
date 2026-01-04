// components/ui/stylised-label.tsx
"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { scheduleScrollTriggerRefresh } from "@/lib/refresh-manager";

gsap.registerPlugin(ScrollTrigger);

type StylizedLabelProps = {
  text: string;
  animateOnMount?: boolean; // loader one-shot
  animateOnScroll?: boolean; // scroll-triggered
};

function getHsContainerAnimation(): gsap.core.Animation | null {
  try {
    const parentST = ScrollTrigger.getById("hs-horizontal") as ScrollTrigger | null;
    const anim = (parentST as any)?.animation as gsap.core.Animation | undefined;
    return anim ?? null;
  } catch {
    return null;
  }
}

export function StylizedLabel({
  text,
  animateOnMount = false,
  animateOnScroll = false,
}: StylizedLabelProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useGSAP(
    () => {
      if (typeof window === "undefined") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const container = containerRef.current;
      if (!container) return;

      const letters = container.querySelectorAll<HTMLElement>("[data-letter]");
      if (!letters.length) return;

      // MODE 1: one-shot mount animation (loader)
      if (animateOnMount && !animateOnScroll) {
        const tl = gsap.timeline();

        gsap.set(letters, { clearProps: "transform,opacity" });

        tl.fromTo(
          letters,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.03,
            clearProps: "transform,opacity",
          }
        );

        return () => tl.kill();
      }

      if (!animateOnScroll) return;

      const panel = container.closest("section") as HTMLElement | null;
      const rail = container.closest(".hs-rail") as HTMLElement | null;
      const isInsideRail = !!rail;

      const tl = gsap.timeline({ paused: true });

      // Set initial state explicitly (avoid immediateRender surprises)
      gsap.set(letters, { y: 80, opacity: 0, willChange: "transform,opacity" });

      tl.to(letters, {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "circ.out",
        stagger: 0.02,
        clearProps: "willChange",
      });

      let st: ScrollTrigger | null = null;

      const makeTrigger = (containerAnimation: gsap.core.Animation | null) => {
        st?.kill();
        st = null;

        const callbacks = {
          onEnter: () => tl.play(0),
          onLeave: () => tl.reverse(),
          onEnterBack: () => tl.play(),
          onLeaveBack: () => tl.reverse(0),
        };

        // If we're inside the HS rail, we REQUIRE containerAnimation.
        if (isInsideRail) {
          if (!containerAnimation) return false;

          st = ScrollTrigger.create({
            trigger: panel ?? container,
            containerAnimation,
            start: "left 80%",
            end: "right 20%",
            ...callbacks,
          });

          return true;
        }

        // Normal vertical page
        st = ScrollTrigger.create({
          trigger: panel ?? container,
          start: "top 80%",
          end: "bottom 20%",
          ...callbacks,
        });

        return true;
      };

      const ensure = () => {
        const containerAnimation = getHsContainerAnimation();
        const ok = makeTrigger(containerAnimation);

        if (ok) {
          // Never refresh synchronously here. Queue it.
          scheduleScrollTriggerRefresh();
        }

        return ok;
      };

      // If in rail and hs-horizontal isn't ready yet, wait for hs-ready (no fallback trigger).
      if (isInsideRail && !getHsContainerAnimation()) {
        const onReady = () => {
          ensure();
        };
        window.addEventListener("hs-ready", onReady, { once: true });

        return () => {
          window.removeEventListener("hs-ready", onReady as any);
          st?.kill();
          tl.kill();
        };
      }

      // Otherwise create immediately
      ensure();

      return () => {
        st?.kill();
        tl.kill();
      };
    },
    { scope: containerRef, dependencies: [animateOnMount, animateOnScroll, text] }
  );

  const words = text.trim().split(/\s+/);

  return (
    <span ref={containerRef} aria-label={text}>
      {words.map((word, wordIndex) => {
        if (!word.length) return null;
        const chars = Array.from(word);

        return (
          <span key={wordIndex} className="inline-block mr-2 align-baseline">
            {chars.map((char, charIndex) => {
              const isFirstLetter = charIndex === 0;

              return (
                <span
                  key={charIndex}
                  className="inline-block leading-none font-normal transition-transform duration-250 ease-out hover:-translate-y-5"
                >
                  <span
                    data-letter
                    className={[
                      "inline-block",
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
  );
}
