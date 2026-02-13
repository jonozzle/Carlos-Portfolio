// components/ads/advert.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import clsx from "clsx";
import { highSrc, lowSrc } from "@/lib/img";
import { useThemeActions, type ThemeInput } from "@/components/theme-provider";
import { APP_EVENTS } from "@/lib/app-events";
import { getLastMouse, HOVER_EVENTS, isHoverLocked } from "@/lib/hover-lock";
import { useHoverCapable } from "@/lib/use-hover-capable";

export type AdvertImage = {
    asset?: { url?: string | null; width?: number | null; height?: number | null } | null;
    alt?: string | null;
};

function isAppScrolling() {
    if (typeof window === "undefined") return false;
    return !!(window as any).__appScrolling;
}

type Props = {
    images?: AdvertImage[] | null;
    className?: string;
    size?: "half" | "full" | "auto";
    defaultIndex?: number;
    label?: string;
    showUI?: boolean;
    theme?: ThemeInput | null;
};

type PreparedImage = {
    hi: string;
    lo: string;
    alt: string;
};

export default function Advert({
    images = [],
    className,
    size = "auto",
    defaultIndex = 0,
    label = "Advertisement",
    showUI = false,
    theme = null,
}: Props) {
    const themeActions = useThemeActions();
    const hasTheme = !!(theme?.bg || theme?.text);
    const hoverCapable = useHoverCapable();

    // data
    const prepared = useMemo<PreparedImage[]>(() => {
        const maxWidth =
            size === "full" ? 3200 : size === "half" ? 2400 : 2800;

        return (images ?? [])
            .filter(i => i?.asset?.url)
            .map(i => {
                const raw = i!.asset!.url as string;
                return {
                    hi: highSrc(raw, maxWidth, 90),
                    lo: lowSrc(raw, 24),
                    alt: i!.alt ?? "",
                };
            });
    }, [images, size]);

    const len = prepared.length;

    // state
    const startIdx = Math.min(defaultIndex, Math.max(0, len - 1));
    const [curr, setCurr] = useState(startIdx);
    const [prev, setPrev] = useState<number | null>(null);
    const [ready, setReady] = useState(false);

    // refs
    const wrapRef = useRef<HTMLDivElement>(null);
    const geom = useRef<{ left: number; width: number }>({ left: 0, width: 1 });
    const rafRef = useRef<number | null>(null);
    const lastSwap = useRef(0);
    const clearPrevTO = useRef<number | null>(null);

    const applyTheme = useCallback(
        (allowIdle?: boolean, force?: boolean) => {
            if (!hasTheme) return;
            const forceAnim = typeof force === "boolean" ? force : isAppScrolling();
            themeActions.previewTheme(theme, { animate: true, force: forceAnim, allowIdle: !!allowIdle });
        },
        [hasTheme, themeActions, theme]
    );

    const clearTheme = useCallback(
        (force?: boolean) => {
            if (!hasTheme) return;
            const forceAnim = typeof force === "boolean" ? force : isAppScrolling();
            themeActions.clearPreview({ animate: true, force: forceAnim });
        },
        [hasTheme, themeActions]
    );

    const isPointerInside = useCallback(() => {
        if (!hoverCapable) return false;
        if (typeof document === "undefined") return false;
        const el = wrapRef.current;
        if (!el) return false;

        const pos = getLastMouse();
        if (pos) {
            const hit = document.elementFromPoint(pos.x, pos.y);
            return !!(hit && el.contains(hit));
        }

        return el.matches(":hover");
    }, [hoverCapable]);

    useEffect(() => {
        if (typeof window === "undefined" || !hasTheme) return;

        const onScrollEnd = () => {
            if (isHoverLocked()) return;
            if (!hoverCapable) {
                clearTheme();
                return;
            }
            if (isPointerInside()) applyTheme(true);
            else clearTheme();
        };

        window.addEventListener(APP_EVENTS.SCROLL_END, onScrollEnd);
        return () => window.removeEventListener(APP_EVENTS.SCROLL_END, onScrollEnd as any);
    }, [applyTheme, clearTheme, hasTheme, hoverCapable, isPointerInside]);

    useEffect(() => {
        if (typeof window === "undefined" || !hasTheme) return;

        const onUnlocked = () => {
            if (!hoverCapable) return;
            if (isPointerInside()) applyTheme(true);
        };

        window.addEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked);
        return () => window.removeEventListener(HOVER_EVENTS.UNLOCKED, onUnlocked as any);
    }, [applyTheme, hasTheme, hoverCapable, isPointerInside]);

    // measure
    const measure = useCallback(() => {
        const el = wrapRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        geom.current.left = r.left;
        geom.current.width = Math.max(1, r.width);
    }, []);

    useEffect(() => {
        measure();
        const el = wrapRef.current;
        if (!el) return;

        const ro = new ResizeObserver(measure);
        ro.observe(el);
        const onResize = () => measure();
        window.addEventListener("resize", onResize);

        return () => {
            ro.disconnect();
            window.removeEventListener("resize", onResize);
        };
    }, [measure]);

    // predecode on idle, non-blocking
    useEffect(() => {
        if (!len) return;
        if (typeof window === "undefined") return;

        const idle: (cb: () => void) => void =
            (window as any).requestIdleCallback?.bind(window) ||
            ((cb: () => void) => window.setTimeout(cb, 1));

        let cancelled = false;

        idle(() => {
            if (cancelled) return;
            // cap how many we predecode – avoid nuking the main thread
            prepared.slice(0, 6).forEach(p => {
                try {
                    const img = new window.Image();
                    img.decoding = "async" as any;
                    img.src = p.hi;
                    img.decode?.().catch(() => { });
                } catch {
                    // ignore
                }
            });
        });

        // interactivity doesn't wait on decode
        setReady(true);

        return () => {
            cancelled = true;
        };
    }, [len, prepared]);

    // helpers
    const pointToIndex = useCallback(
        (clientX: number) => {
            const { left, width } = geom.current;
            const ratio = Math.min(Math.max((clientX - left) / width, 0), 1);
            return Math.min(len - 1, Math.floor(ratio * len));
        },
        [len],
    );

    const show = useCallback(
        (next: number) => {
            if (next === curr) return;
            setPrev(curr);
            setCurr(next);
            if (clearPrevTO.current) window.clearTimeout(clearPrevTO.current);
            clearPrevTO.current = window.setTimeout(() => setPrev(null), 180);
        },
        [curr],
    );

    // rate-limited scheduling only
    const schedule = useCallback(
        (clientX: number) => {
            if (!ready) return;
            if (rafRef.current != null) return;

            rafRef.current = window.requestAnimationFrame(() => {
                rafRef.current = null;

                const now = performance.now();
                const HZ_MS = 66; // ~15 fps swaps max
                if (now - lastSwap.current < HZ_MS) return;

                const next = pointToIndex(clientX);
                lastSwap.current = now;
                show(next);
            });
        },
        [ready, pointToIndex, show],
    );

    // events
    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!ready) return;
            schedule(e.clientX);
        },
        [schedule, ready],
    );

    const onPointerEnter = useCallback(() => {
        if (!isHoverLocked()) applyTheme();
        measure();
    }, [applyTheme, measure]);

    const onPointerLeave = useCallback(() => {
        if (isHoverLocked()) return;
        if (isAppScrolling() && isPointerInside()) return;
        clearTheme(isAppScrolling());
    }, [clearTheme, isPointerInside]);

    // a11y
    const roleDesc = useMemo(
        () =>
            len > 0
                ? `${label}. ${len} frames. Showing ${curr + 1} of ${len}.`
                : `${label}. No media.`,
        [label, len, curr],
    );

    if (len === 0) {
        return (
            <div
                className={clsx(
                    "relative w-full  grid place-items-center text-xs text-neutral-500",
                    size === "half" && "h-[50vh]",
                    size === "full" && "h-screen",
                )}
            >
                No images
            </div>
        );
    }

    const sizesAttr =
        size === "half" ? "50vw" : size === "full" ? "100vw" : "100vw";

    const renderImg = (i: number | null, active: boolean) => {
        if (i == null) return null;
        const { hi, lo, alt } = prepared[i];

        return (
            <>
                {/* LQIP layer (cheap) */}
                <img
                    src={lo}
                    alt=""
                    aria-hidden="true"
                    className={clsx(
                        "absolute inset-0 w-full h-full object-cover pointer-events-none select-none transition-opacity duration-200",
                        active ? "opacity-100" : "opacity-0",
                    )}
                    style={{ filter: "blur(8px)", transform: "scale(1.02)" }}
                    decoding="async"
                />
                {/* Hi-res layer (capped size) */}
                <NextImage
                    key={hi}
                    src={hi}
                    alt={alt}
                    fill
                    sizes={sizesAttr}
                    decoding="async"
                    priority={i === startIdx}
                    className={clsx(
                        "object-cover transition-opacity duration-200",
                        active ? "opacity-100" : "opacity-0",
                    )}
                    style={{ transform: "translateZ(0)" }}
                />
            </>
        );
    };

    return (
        <div
            ref={wrapRef}
            className={clsx(
                "advert relative w-full overflow-hidden select-none",
                size === "half" && "h-[50vh]",
                size === "full" && "h-screen",
                className,
            )}
            style={{
                contain: "paint",
            }}
            aria-label={roleDesc}
            onPointerMove={onPointerMove}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onFocusCapture={() => {
                if (isHoverLocked()) return;
                applyTheme();
            }}
            onBlurCapture={() => {
                if (isHoverLocked()) return;
                clearTheme(isAppScrolling());
            }}
        >
            <div className="absolute inset-0">{renderImg(prev, false)}</div>
            <div className="absolute inset-0">{renderImg(curr, true)}</div>

            {showUI && (
                <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {Array.from({ length: len }).map((_, i) => (
                        <span
                            key={i}
                            className={clsx("h-[2px] w-6", i === curr ? "bg-white" : "bg-white")}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
