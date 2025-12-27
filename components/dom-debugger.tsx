// components/dom-debugger.tsx
"use client";

import { useEffect } from "react";
import { installRemoveChildTracer } from "@/lib/debug/dom-removechild-trace";

export default function DomDebugger() {
  useEffect(() => {
    installRemoveChildTracer();
  }, []);
  return null;
}
