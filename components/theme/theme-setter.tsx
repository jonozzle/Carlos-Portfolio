// ThemeSetter
// components/theme/theme-setter.tsx
"use client";

import { useEffect } from "react";
import { useThemeActions, type ThemeInput } from "@/components/theme-provider";

type Props =
    | { reset: true; theme?: never }
    | { reset?: false; theme?: ThemeInput | null };

export default function ThemeSetter(props: Props) {
    const { lockTheme, resetTheme } = useThemeActions();

    useEffect(() => {
        if (typeof window === "undefined") return;

        // If we’re navigating PROJECT -> HOME, delay the reset until the hero transition finishes.
        const deferHomeReset = !!(window as any).__deferHomeThemeReset;

        if ("reset" in props && props.reset) {
            if (deferHomeReset) {
                const run = () => {
                    (window as any).__deferHomeThemeReset = false;
                    // Force animation even if __appScrolling is true during transition.
                    resetTheme({ animate: true, force: true });
                };

                const onHeroDone = () => run();
                window.addEventListener("hero-transition-done", onHeroDone, { once: true });

                // Safety fallback
                const t = window.setTimeout(run, 1600);

                return () => {
                    window.removeEventListener("hero-transition-done", onHeroDone as any);
                    window.clearTimeout(t);
                };
            }

            resetTheme({ animate: true });
            return;
        }

        lockTheme(props.theme ?? null, { animate: true });
    }, [props, lockTheme, resetTheme]);

    return null;
}
