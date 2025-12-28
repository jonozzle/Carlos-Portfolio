// components/loader/home-loader-cc.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import ScrollSmoother from "gsap/ScrollSmoother";
import { useLoader } from "@/components/loader-context";
import { preloadAndDecodeImages } from "@/lib/preload-images";
import { setCurrentScrollY } from "@/lib/scroll-state";
import { peekNavIntent } from "@/lib/nav-intent";

if (typeof window !== "undefined") {
  gsap.registerPlugin(SplitText);
}

type Props = {
  enable?: boolean;
  positionOnly?: boolean;
};

const GLOBAL_PLAYED_FLAG = "__homeLoaderPlayedThisTab";
const GLOBAL_INITIAL_PATH = "__initialPathAtLoad";

function openFoucGateNow() {
  if (typeof window === "undefined") return;
  document.documentElement.classList.add("fouc-ready");
}

function closeFoucGateNow() {
  if (typeof window === "undefined") return;
  document.documentElement.classList.remove("fouc-ready");
}

function getNavigationType(): "navigate" | "reload" | "back_forward" | "prerender" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type) return nav.type;
  // legacy fallback
  // @ts-ignore
  const legacyType = performance.navigation?.type;
  if (legacyType === 1) return "reload";
  if (legacyType === 2) return "back_forward";
  return "unknown";
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

    // record the path the tab actually loaded on (so project reload → home doesn’t trigger loader)
    if (!(window as any)[GLOBAL_INITIAL_PATH]) {
      (window as any)[GLOBAL_INITIAL_PATH] = window.location.pathname;
    }

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

    // Never run loader when returning from project (intent set).
    // (This also covers “nav.type stays reload for the entire tab”.)
    const intent = peekNavIntent();
    if (intent.kind === "project-to-home") {
      setAllowed(false);
      setDone(true);
      setLoaderDone(true);
      openFoucGateNow();
      return;
    }

    // Only run on a TRUE reload of the tab AND only if the tab loaded on "/"
    const navType = getNavigationType();
    const initialPath = (window as any)[GLOBAL_INITIAL_PATH] as string | undefined;
    const alreadyPlayed = !!(window as any)[GLOBAL_PLAYED_FLAG];

    const shouldPlay = navType === "reload" && initialPath === "/" && !alreadyPlayed;

    if (!shouldPlay) {
      setAllowed(false);
      setDone(true);
      setLoaderDone(true);
      openFoucGateNow();
      return;
    }

    // mark immediately so SPA navigations back to "/" don’t re-trigger
    (window as any)[GLOBAL_PLAYED_FLAG] = true;

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

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const markDone = () => {
        setDone(true);
        setAllowed(false);
        setLoaderDone(true);
      };

      // Loader owns initial entry visuals; stop PageEnterShell fade
      (window as any).__pageEnterSkipInitial = true;
      try {
        window.dispatchEvent(new Event("page-enter-skip-initial"));
      } catch {
        // ignore
      }

      // Force home to top on cold reload
      try {
        ScrollSmoother.get()?.scrollTo(0, false);
      } catch {
        // ignore
      }
      try {
        window.scrollTo(0, 0);
      } catch {
        // ignore
      }
      try {
        setCurrentScrollY(0);
      } catch {
        // ignore
      }

      gsap.set(root, { autoAlpha: 1, xPercent: 0 });

      if (pageRoot) {
        gsap.set(pageRoot, { xPercent: 100, opacity: 1 });
      }

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
