// components/loader-context.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";

type LoaderContextValue = {
  loaderDone: boolean;
  setLoaderDone: (done: boolean) => void;
};

const LoaderContext = createContext<LoaderContextValue | undefined>(undefined);

export function LoaderProvider({ children }: { children: ReactNode }) {
  const [loaderDone, setLoaderDone] = useState(false);

  const value = useMemo(
    () => ({
      loaderDone,
      setLoaderDone,
    }),
    [loaderDone]
  );

  return (
    <LoaderContext.Provider value={value}>{children}</LoaderContext.Provider>
  );
}

export function useLoader() {
  const ctx = useContext(LoaderContext);
  if (!ctx) {
    throw new Error("useLoader must be used within a LoaderProvider");
  }
  return ctx;
}
