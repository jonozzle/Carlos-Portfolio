// components/hscroller-wrapper.tsx
"use client";

import { usePathname } from "next/navigation";
import HorizontalScroller from "@/components/horizontal-scroller";

export default function HScrollerWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // force a fresh GSAP setup on each route
  return <HorizontalScroller key={pathname}>{children}</HorizontalScroller>;
}
