// components/page-theme-setter.tsx
"use client";

import { useEffect } from "react";
import { useTheme, type ThemeInput } from "@/components/theme-provider";

type Props = {
  theme?: ThemeInput | null;
};

export default function PageThemeSetter({ theme }: Props) {
  const { lockTheme } = useTheme();

  useEffect(() => {
    lockTheme(theme ?? null);
  }, [theme, lockTheme]);

  return null;
}
