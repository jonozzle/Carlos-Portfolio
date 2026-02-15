// ThemeSetter
// components/theme/theme-setter.tsx
"use client";

import { useLayoutEffect } from "react";
import { useThemeActions, type ThemeInput, type ThemeApplyOptions } from "@/components/theme-provider";
import { APP_EVENTS } from "@/lib/app-events";

type Props =
    | { reset: true; theme?: never }
    | { reset?: false; theme?: ThemeInput | null };

export default function ThemeSetter(props: Props) {
    const { lockTheme, resetTheme } = useThemeActions();

    const isReset = "reset" in props && props.reset;
    const theme = isReset ? null : (props.theme ?? null);

    useLayoutEffect(() => {
        if (typeof window === "undefined") return;

        // If this page sets theme during hydration, prevent ThemeProvider's boot effect
        // from re-applying DEFAULT_THEME afterwards on hard reload.
        (window as any).__themeBootstrapped = true;

        // On the very first hydration of the session, do not animate the theme change.
        // Subsequent SPA navigations should animate normally.
        const firstHydration = !(window as any).__themeHydrated;
        if (firstHydration) (window as any).__themeHydrated = true;

        const navForce = !!(window as any).__navInProgress;

        const baseOpts: ThemeApplyOptions = firstHydration
            ? { animate: false, force: true }
            : { animate: true, force: navForce };

        // If we’re navigating PROJECT -> HOME, delay the reset until the hero transition finishes.
        const deferHomeReset = !!(window as any).__deferHomeThemeReset;

        if (isReset) {
            if (deferHomeReset) {
                let done = false;
                let t: number | null = null;

                const run = () => {
                    if (done) return;
                    done = true;
                    if (t) window.clearTimeout(t);
                    window.removeEventListener("hero-transition-done", onHeroDone as any);
                    (window as any).__deferHomeThemeReset = false;
                    // Always animate this reset (this is a navigation transition, not a cold load)
                    resetTheme({ animate: true, force: true });
                };

                const onHeroDone = () => run();
                window.addEventListener("hero-transition-done", onHeroDone, { once: true });

                // Safety fallback
                t = window.setTimeout(run, 1600);

                return () => {
                    window.removeEventListener("hero-transition-done", onHeroDone as any);
                    if (t) window.clearTimeout(t);
                };
            }

            // If a navigation is already in progress, avoid resetting immediately.
            // This prevents "clicked theme -> home reset -> destination theme" flashes.
            if (navForce) {
                let done = false;
                let t: number | null = null;

                const run = () => {
                    if (done) return;
                    done = true;
                    if (t) window.clearTimeout(t);
                    window.removeEventListener(APP_EVENTS.NAV_END, onNavEnd as any);
                    resetTheme({ animate: true, force: true });
                };

                const onNavEnd = () => run();
                window.addEventListener(APP_EVENTS.NAV_END, onNavEnd, { once: true });

                t = window.setTimeout(run, 1400);

                return () => {
                    window.removeEventListener(APP_EVENTS.NAV_END, onNavEnd as any);
                    if (t) window.clearTimeout(t);
                };
            }

            resetTheme(baseOpts);
            return;
        }

        lockTheme(theme, baseOpts);
    }, [isReset, theme, lockTheme, resetTheme]);

    return null;
}
