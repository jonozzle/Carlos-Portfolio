// components/theme/theme-setter.tsx
"use client";

import { useEffect } from "react";
import { useTheme, type ThemeInput } from "@/components/theme-provider";

type Props =
    | { reset: true; theme?: never }
    | { reset?: false; theme?: ThemeInput | null };

export default function ThemeSetter(props: Props) {
    const { lockTheme, resetTheme } = useTheme();

    useEffect(() => {
        if ("reset" in props && props.reset) {
            resetTheme();
            return;
        }

        lockTheme(props.theme ?? null);
    }, [props, lockTheme, resetTheme]);

    return null;
}
