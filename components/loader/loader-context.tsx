// components/loader-context.tsx
"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type LoaderContextValue = {
  loaderDone: boolean;
  setLoaderDone: (done: boolean) => void;
};

const LoaderContext = createContext<LoaderContextValue | null>(null);

export function LoaderProvider({ children }: { children: React.ReactNode }) {
  const [loaderDone, _setLoaderDone] = useState<boolean>(true);

  const setLoaderDone = useCallback((done: boolean) => {
    _setLoaderDone(done);

    // Optional global mirrors for debugging / edge-case fallbacks
    if (typeof window !== "undefined") {
      (window as any).__loaderDone = done;
      try {
        window.dispatchEvent(
          new CustomEvent("loader-done-change", { detail: { done } })
        );
      } catch {
        // ignore
      }
    }
  }, []);

  const value = useMemo(() => ({ loaderDone, setLoaderDone }), [loaderDone, setLoaderDone]);

  return <LoaderContext.Provider value={value}>{children}</LoaderContext.Provider>;
}

export function useLoader() {
  const ctx = useContext(LoaderContext);
  if (!ctx) throw new Error("useLoader must be used within <LoaderProvider />");
  return ctx;
}
