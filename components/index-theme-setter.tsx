// components/theme/index-theme-setter.tsx
"use client";

import { useEffect } from "react";
import { useTheme } from "@/components/theme-provider";

export default function IndexThemeSetter() {
  const { resetTheme } = useTheme();

  useEffect(() => {
    resetTheme();
  }, [resetTheme]);

  return null;
}
