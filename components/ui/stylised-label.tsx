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
  animateOnMount?: boolean;
  animateOnScroll?: boolean;
};

function requestIdle(fn: () => void, timeout = 350) {
  // @ts-ignore
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    // @ts-ignore
    return window.requestIdleCallback(fn, { timeout });
  }
  return window.setTimeout(fn, 0);
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

      // MODE 1: animate once on mount (no ScrollTrigger)
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
          }
        );

        return () => tl.kill();
      }

      if (!animateOnScroll) return;

      const panel = container.closest("section") as HTMLElement | null;
      const rail = panel?.closest(".hs-rail") as HTMLElement | null;

      const timeline = gsap.timeline({ paused: true });

      timeline.from(letters, {
        y: 80,
        opacity: 0,
        duration: 0.6,
        ease: "circ.out",
        stagger: 0.02,
        immediateRender: true,
      });

      let st: ScrollTrigger | null = null;

      const setupAnimation = () => {
        const parentST = ScrollTrigger.getById("hs-horizontal") as ScrollTrigger | null;
        const containerAnimation = (parentST as any)?.animation;

        const callbacks = {
          onEnter: () => timeline.play(0),
          onLeave: () => timeline.reverse(),
          onEnterBack: () => timeline.play(),
          onLeaveBack: () => timeline.reverse(0),
        };

        st?.kill();

        if (panel && rail && containerAnimation) {
          st = ScrollTrigger.create({
            trigger: panel,
            containerAnimation,
            start: "left 80%",
            end: "right 20%",
            ...callbacks,
          });
        } else {
          st = ScrollTrigger.create({
            trigger: panel ?? container,
            start: "top 80%",
            end: "bottom 20%",
            ...callbacks,
          });
        }

        // IMPORTANT: do NOT call ScrollTrigger.refresh(true) here.
        // Queue refresh so it never happens at scroll settle.
        scheduleScrollTriggerRefresh();
      };

      const shouldWaitForHs = !!(rail && !ScrollTrigger.getById("hs-horizontal"));

      if (shouldWaitForHs) {
        // Prefer event; fallback to idle (no timers hitting scroll end)
        const onReady = () => setupAnimation();
        window.addEventListener("hs-ready", onReady, { once: true });

        const idleId = requestIdle(() => {
          // if HS never arrives, still set up a normal trigger
          setupAnimation();
        });

        return () => {
          window.removeEventListener("hs-ready", onReady as any);
          // @ts-ignore
          if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
          else clearTimeout(idleId);
          st?.kill();
          timeline.kill();
        };
      }

      setupAnimation();

      return () => {
        st?.kill();
        timeline.kill();
      };
    },
    {
      scope: containerRef,
      dependencies: [animateOnMount, animateOnScroll, text],
    }
  );

  const words = text.trim().split(/\s+/);

  return (
    <span ref={containerRef} aria-label={text}>
      {words.map((word, wordIndex) => {
        if (!word.length) return null;
        const letters = Array.from(word);

        return (
          <span key={wordIndex} className="inline-block mr-2 align-baseline">
            {letters.map((char, charIndex) => {
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
