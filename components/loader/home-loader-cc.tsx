// components/loader/home-loader-cc.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import { useLoader } from "@/components/loader-context";
import { preloadAndDecodeImages } from "@/lib/preload-images";

/**
 * Toggle this to force the loader to play on every visit to "/"
 * (ignores the session key).
 */
const PLAY_EVERY_TIME = true;

const SESSION_KEY = "homeLoaderSeen";

if (typeof window !== "undefined") {
  gsap.registerPlugin(SplitText);
}

type Props = {
  enable?: boolean;
  /**
   * Legacy prop: no-op.
   */
  positionOnly?: boolean;
};

function readLoaderFlags() {
  if (typeof window === "undefined") {
    return { force: false, disable: false, reset: false };
  }
  const url = new URL(window.location.href);
  const p = url.searchParams;

  const force = p.get("loader") === "1" || p.get("forceLoader") === "1";
  const disable = p.get("loader") === "0";
  const reset = p.get("resetLoader") === "1";

  return { force, disable, reset };
}

function stripParam(param: string) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(param)) return;
    url.searchParams.delete(param);
    window.history.replaceState({}, "", url.toString());
  } catch {
    // ignore
  }
}

function openFoucGateNow() {
  if (typeof window === "undefined") return;
  document.documentElement.classList.add("fouc-ready");
}

function closeFoucGateNow() {
  if (typeof window === "undefined") return;
  document.documentElement.classList.remove("fouc-ready");
}

export default function HomeLoaderCC({ enable = true, positionOnly = false }: Props) {
  const pathname = usePathname();
  const { setLoaderDone } = useLoader();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const nameRowRef = useRef<HTMLDivElement | null>(null);
  const bigCRef = useRef<HTMLSpanElement | null>(null);
  const smallCRef = useRef<HTMLSpanElement | null>(null);
  const restFirstRef = useRef<HTMLSpanElement | null>(null);
  const restSecondRef = useRef<HTMLSpanElement | null>(null);

  const [done, setDone] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!enable || positionOnly) {
      setAllowed(false);
      setDone(true);
      setLoaderDone(true);
      openFoucGateNow();
      return;
    }

    const isHome = pathname === "/";
    if (!isHome) {
      setAllowed(false);
      setDone(true);
      setLoaderDone(true);
      openFoucGateNow();
      return;
    }

    const flags = readLoaderFlags();

    if (flags.disable) {
      setAllowed(false);
      setDone(true);
      setLoaderDone(true);
      openFoucGateNow();
      return;
    }

    if (flags.reset) {
      try {
        window.sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
      stripParam("resetLoader");
    }

    if (!PLAY_EVERY_TIME && !flags.force) {
      let seen = false;
      try {
        seen = window.sessionStorage.getItem(SESSION_KEY) === "1";
      } catch {
        // ignore
      }
      if (seen) {
        setAllowed(false);
        setDone(true);
        setLoaderDone(true);
        openFoucGateNow();
        return;
      }
    }

    if (flags.force) {
      stripParam("loader");
      stripParam("forceLoader");
    }

    // We are going to play the loader: close the gate for this entry.
    closeFoucGateNow();

    setDone(false);
    setAllowed(true);
    setLoaderDone(false);
  }, [pathname, enable, positionOnly, setLoaderDone]);

  useGSAP(
    () => {
      if (!allowed || !enable || positionOnly) return;

      const root = rootRef.current;
      const nameRow = nameRowRef.current;
      const bigC = bigCRef.current;
      const smallC = smallCRef.current;
      const restFirst = restFirstRef.current;
      const restSecond = restSecondRef.current;
      const pageRoot = document.getElementById("page-root");

      if (!root || !nameRow || !bigC || !smallC || !restFirst || !restSecond) return;

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const markDone = () => {
        try {
          if (!PLAY_EVERY_TIME) {
            window.sessionStorage.setItem(SESSION_KEY, "1");
          }
        } catch {
          // ignore
        }
        setDone(true);
        setAllowed(false);
        setLoaderDone(true);
      };

      // Let page shells know they must NOT run their own initial fade/entrance.
      (window as any).__pageEnterSkipInitial = true;
      try {
        window.dispatchEvent(new Event("page-enter-skip-initial"));
      } catch {
        // ignore
      }

      gsap.set(root, { autoAlpha: 1, xPercent: 0 });

      // Page off-screen right, but visible (so you can see it slide in).
      if (pageRoot) {
        gsap.set(pageRoot, { xPercent: 100, opacity: 1 });
      }

      // Now that initial transforms are set, open the gate (no flash).
      openFoucGateNow();

      if (reduced) {
        if (pageRoot) gsap.set(pageRoot, { xPercent: 0, opacity: 1, clearProps: "transform" });
        gsap.set(root, { autoAlpha: 0 });
        markDone();
        return;
      }

      const splitFirst = new SplitText(restFirst, { type: "chars" });
      const splitSecond = new SplitText(restSecond, { type: "chars" });

      const firstChars = splitFirst.chars;
      const secondChars = splitSecond.chars;

      gsap.set([restFirst, restSecond], { opacity: 1 });
      gsap.set([...firstChars, ...secondChars], { opacity: 0, x: 10 });

      const collectPreloadUrls = () => {
        const scope = pageRoot ?? document;
        const nodes = Array.from(scope.querySelectorAll<HTMLElement>("[data-preload-src]"));
        return nodes
          .map((n) => n.getAttribute("data-preload-src") || "")
          .filter(Boolean);
      };

      const runPreloadGate = async () => {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        const urls = collectPreloadUrls();
        await preloadAndDecodeImages(urls, { concurrency: 6, timeoutMs: 8000 });

        (window as any).__imagesPreloaded = true;
        try {
          window.dispatchEvent(new Event("images-preloaded"));
        } catch {
          // ignore
        }
      };

      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      const bigRect = bigC.getBoundingClientRect();
      const smallRect = smallC.getBoundingClientRect();

      const centerX = screenW / 2;
      const centerY = screenH / 2;

      const bigCenterX = bigRect.left + bigRect.width / 2;
      const bigCenterY = bigRect.top + bigRect.height / 2;
      const smallCenterX = smallRect.left + smallRect.width / 2;
      const smallCenterY = smallRect.top + smallRect.height / 2;

      const bigDx = centerX - bigCenterX;
      const bigDy = centerY - bigCenterY;
      const smallDx = centerX - smallCenterX;
      const smallDy = centerY - smallCenterY;

      gsap.set(bigC, { x: bigDx, y: bigDy, rotation: 0 });
      gsap.set(smallC, { x: smallDx - 6, y: smallDy + 6, rotation: -185 });
      gsap.set([bigC, smallC], { opacity: 0, scale: 0 });

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.to(bigC, { opacity: 1, duration: 0.5, scale: 1, ease: "power2.inOut" }, 0);
      tl.to(smallC, { opacity: 1, duration: 0.5, scale: 1, ease: "power2.inOut" }, "+=0.2");

      tl.to([bigC, smallC], { x: 0, y: 0, rotation: 0, duration: 1.4, ease: "power2.inOut" }, "-=0.5");

      tl.to(firstChars, { opacity: 1, x: 0, duration: 0.8, stagger: 0.04, ease: "power2.inOut" }, "-=0.4");
      tl.to(firstChars, { x: (i) => 4 * i, duration: 3, ease: "power1.inOut" }, "<");

      tl.to(secondChars, { opacity: 1, x: 0, duration: 0.8, stagger: 0.04, ease: "power2.inOut" }, "<+0.1");
      tl.to(secondChars, { x: (i) => 4 * i, duration: 3, ease: "power1.inOut" }, "<");

      tl.to(bigC, { x: -12, duration: 3, ease: "power1.inOut" }, "<");
      tl.to(smallC, { x: 12, duration: 3, ease: "power1.inOut" }, "<");

      tl.add(() => {
        tl.pause();
        runPreloadGate()
          .catch(() => { })
          .finally(() => tl.resume());
      });

      tl.to(root, { xPercent: -100, duration: 1.5, ease: "power3.inOut" });

      if (pageRoot) {
        tl.to(
          pageRoot,
          {
            xPercent: 0,
            duration: 1.5,
            ease: "power3.inOut",
            clearProps: "transform",
            onComplete: () => {
              gsap.set(root, { autoAlpha: 0 });
              markDone();
            },
          },
          "<"
        );
      } else {
        tl.set(root, { autoAlpha: 0 });
        markDone();
      }

      return () => {
        tl.kill();
        splitFirst.revert();
        splitSecond.revert();
      };
    },
    { scope: rootRef, dependencies: [allowed, enable, positionOnly, setLoaderDone] }
  );

  if (!enable || positionOnly) return null;
  if (done || !allowed) return null;

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100000] isolate flex items-center justify-center bg-gray-200">
      <div ref={nameRowRef} className="flex items-baseline text-black">
        <span ref={bigCRef} className="font-serif text-[110px] leading-none inline-block">
          C
        </span>

        <span ref={restFirstRef} className="font-serif text-[78px] leading-none tracking-tight inline-block ml-2">
          arlos
        </span>

        <span ref={smallCRef} className="font-serif text-[110px] leading-none inline-block ml-5">
          C
        </span>

        <span ref={restSecondRef} className="font-serif text-[78px] leading-none tracking-tight inline-block ml-2">
          astrosin
        </span>
      </div>
    </div>
  );
}
