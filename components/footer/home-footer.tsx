// components/footer/home-footer.tsx
"use client";

import { useMemo, useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { PortableText } from "next-sanity";
import { StylizedLabel } from "@/components/ui/stylised-label";
import UnderlineLink from "@/components/ui/underline-link";
import SmoothImage from "@/components/ui/smooth-image";
import type { FooterData } from "@/sanity/lib/fetch";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

type FooterLink = NonNullable<FooterData["links"]>[number];
type FooterImage = NonNullable<FooterData["images"]>[number];

type Props = {
    footer: FooterData;
};

export default function HomeFooter({ footer }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const marqueeTrackRef = useRef<HTMLDivElement>(null);

    const title = footer.title ?? "";
    const links = (footer.links ?? []) as FooterLink[];
    const images = (footer.images ?? []) as FooterImage[];
    const copyright = footer.copyright ?? "";

    // new: portable text on bottom-right
    const rightBody = ((footer as any).rightBody ?? []) as any[];

    const hasImages = images.length > 0;

    // Double the array for an infinite loop (track is exactly 200% of content height)
    const scrollingImages = useMemo(
        () => (hasImages ? [...images, ...images] : []),
        [hasImages, images]
    );

    const rightBodyComponents = useMemo(
        () => ({
            block: {
                normal: ({ children }: any) => (
                    <p className="text-xs md:text-sm leading-relaxed opacity-70 text-center md:text-right">
                        {children}
                    </p>
                ),
            },
            list: {
                bullet: ({ children }: any) => (
                    <ul className="list-disc list-inside space-y-1 text-xs md:text-sm opacity-70 text-right">
                        {children}
                    </ul>
                ),
                number: ({ children }: any) => (
                    <ol className="list-decimal list-inside space-y-1 text-xs md:text-sm opacity-70 text-right">
                        {children}
                    </ol>
                ),
            },
            listItem: {
                bullet: ({ children }: any) => <li>{children}</li>,
                number: ({ children }: any) => <li>{children}</li>,
            },
            marks: {
                link: ({ children, value }: any) => {
                    const href = value?.href as string | undefined;
                    const blank = !!value?.blank;
                    if (!href) return <>{children}</>;

                    return (
                        <UnderlineLink
                            href={href}
                            hoverUnderline
                            target={blank ? "_blank" : undefined}
                            rel={blank ? "noreferrer noopener" : undefined}
                            className="hover:opacity-70 transition-opacity"
                        >
                            {children}
                        </UnderlineLink>
                    );
                },
            },
        }),
        []
    );

    useGSAP(
        () => {
            if (typeof window === "undefined") return;

            const root = containerRef.current;
            const titleEl = titleRef.current;
            const track = marqueeTrackRef.current;
            if (!root) return;

            const prefersReduced =
                window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

            let raf = 0;

            let titleTween: gsap.core.Tween | null = null;
            let marqueeTween: gsap.core.Tween | null = null;

            let stTitle: ScrollTrigger | null = null;
            let stMarquee: ScrollTrigger | null = null;

            const killScrollBits = () => {
                try {
                    stTitle?.kill(true);
                } catch {
                    // ignore
                }
                try {
                    stMarquee?.kill(true);
                } catch {
                    // ignore
                }
                stTitle = null;
                stMarquee = null;

                try {
                    titleTween?.kill();
                } catch {
                    // ignore
                }
                titleTween = null;
            };

            const killMarqueeTween = () => {
                try {
                    marqueeTween?.kill();
                } catch {
                    // ignore
                }
                marqueeTween = null;
            };

            const getHsContainerAnimation = () => {
                const hs = ScrollTrigger.getById("hs-horizontal") as ScrollTrigger | null;
                return hs?.animation ?? null;
            };

            const getHsMode = () => {
                try {
                    return (window as any).__hsMode as string | undefined;
                } catch {
                    return undefined;
                }
            };

            const expectsHs = () => !!root.closest(".hs-rail");

            // Marquee tween (pure transform loop; no rerenders; paused until footer is in-view)
            const ensureMarqueeTween = () => {
                killMarqueeTween();

                if (!hasImages || !track || prefersReduced) return;

                gsap.set(track, { yPercent: 0, force3D: true });

                marqueeTween = gsap.to(track, {
                    yPercent: -50,
                    ease: "none",
                    duration: 30,
                    repeat: -1,
                    paused: true,
                    force3D: true,
                    autoRound: false,
                });
            };

            const buildTriggers = () => {
                killScrollBits();

                const containerAnimation = getHsContainerAnimation();
                const hsMode = getHsMode();
                const isHsVertical = hsMode === "vertical";
                const isInsideHs = expectsHs();

                // If we’re inside the HS rail, do not create “normal” vertical triggers
                // until HS is ready (unless we’re in mobile/vertical mode).
                if (isInsideHs && !containerAnimation && !isHsVertical) return;

                // Base trigger settings (HS-aware when available)
                const base: ScrollTrigger.Vars =
                    containerAnimation && !isHsVertical
                        ? {
                            trigger: root,
                            start: "left 80%",
                            end: "right 20%",
                            containerAnimation,
                            invalidateOnRefresh: false,
                        }
                        : {
                            trigger: root,
                            start: "top 80%",
                            end: "bottom 20%",
                            invalidateOnRefresh: false,
                        };

                // Title on/off (enter + leave in both directions)
                if (titleEl) {
                    if (prefersReduced) {
                        gsap.set(titleEl, { clearProps: "opacity,transform" });
                    } else {
                        gsap.set(titleEl, { opacity: 0, y: 18, force3D: true });

                        titleTween = gsap.to(titleEl, {
                            opacity: 1,
                            y: 0,
                            duration: 0.8,
                            ease: "power2.out",
                            paused: true,
                            force3D: true,
                            autoRound: false,
                        });

                        stTitle = ScrollTrigger.create({
                            ...base,
                            onEnter: () => titleTween?.play(),
                            onLeave: () => titleTween?.reverse(),
                            onEnterBack: () => titleTween?.play(),
                            onLeaveBack: () => titleTween?.reverse(),
                        });
                    }
                }

                // Marquee play/pause only while footer is in view (no extra refreshes)
                if (marqueeTween) {
                    stMarquee = ScrollTrigger.create({
                        ...base,
                        onEnter: () => marqueeTween?.play(),
                        onEnterBack: () => marqueeTween?.play(),
                        onLeave: () => marqueeTween?.pause(),
                        onLeaveBack: () => marqueeTween?.pause(),
                    });
                }
            };

            const scheduleBuild = () => {
                if (raf) cancelAnimationFrame(raf);
                raf = requestAnimationFrame(buildTriggers);
            };

            ensureMarqueeTween();
            scheduleBuild();

            // HS lifecycle: rebuild triggers when the horizontal scroller announces readiness/rebuilds.
            window.addEventListener("hs-ready", scheduleBuild);
            window.addEventListener("hs-rebuilt", scheduleBuild);

            return () => {
                window.removeEventListener("hs-ready", scheduleBuild);
                window.removeEventListener("hs-rebuilt", scheduleBuild);

                if (raf) cancelAnimationFrame(raf);
                killScrollBits();
                killMarqueeTween();
            };
        },
        { scope: containerRef, dependencies: [hasImages, images.length, title] }
    );

    return (
        <section
            ref={containerRef}
            className="w-[100vw] h-screen flex-shrink-0 grid grid-cols-12 gap-2 overflow-hidden"
            style={{ contain: "layout paint style" }}
        >
            {/* LEFT SIDE */}
            <div className="col-span-12 md:col-span-6 h-full px-4 py-6 md:p-6">
                <div className="h-full w-full grid grid-rows-[1fr_auto] gap-6">
                    {/* centered title */}
                    <div className="flex items-center justify-center">
                        {title ? (
                            <h2
                                ref={titleRef}
                                className="text-3xl md:text-5xl font-serif tracking-tight leading-none text-center will-change-transform"
                            >
                                <StylizedLabel text={title} />
                            </h2>
                        ) : null}
                    </div>

                    {/* bottom row: links bottom-left + portable text bottom-right */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-end">
                        <div className="flex flex-col gap-3 items-center md:items-start">
                            {links.length > 0 ? (
                                <div className="flex flex-wrap gap-3 md:gap-4 text-xs md:text-sm">
                                    {links.map((link) => {
                                        const href = (link as any)?.href as string | undefined;
                                        const label = (link as any)?.label as string | undefined;
                                        const newTab = !!(link as any)?.newTab;

                                        if (!href || !label) return null;

                                        return (
                                            <UnderlineLink
                                                key={(link as any)?._key ?? href}
                                                href={href}
                                                hoverUnderline
                                                target={newTab ? "_blank" : undefined}
                                                rel={newTab ? "noreferrer noopener" : undefined}
                                                className="hover:opacity-70 transition-opacity"
                                            >
                                                {label}
                                            </UnderlineLink>
                                        );
                                    })}
                                </div>
                            ) : null}


                        </div>

                        <div className="space-y-2 text-right">
                            {Array.isArray(rightBody) && rightBody.length > 0 ? (
                                <PortableText value={rightBody} components={rightBodyComponents as any} />
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="col-span-12 md:col-span-6 h-[70svh] md:h-full overflow-hidden relative transform-gpu">
                {hasImages ? (
                    <div className="relative h-full w-full overflow-hidden">
                        <div
                            ref={marqueeTrackRef}
                            className="flex flex-col w-full will-change-transform transform-gpu"
                            aria-hidden="true"
                        >
                            {scrollingImages.map((img, i) => {
                                if (!img?.url) return null;
                                const isFirst = i === 0;

                                return (
                                    <div key={`${img._key}-${i}`} className="w-full flex-shrink-0">
                                        <div className="relative w-full aspect-[3/4] overflow-hidden contain-paint will-change-transform transform-gpu">
                                            <SmoothImage
                                                src={img.url}
                                                alt={img.alt ?? ""}
                                                hiMaxWidth={900}
                                                sizes="(max-width: 768px) 100vw, 50vw"
                                                objectFit="cover"
                                                quality={80}
                                                priority={isFirst}
                                                loading={isFirst ? "eager" : "lazy"}
                                                fetchPriority={isFirst ? "high" : "low"}
                                                lqipWidth={16}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-xs opacity-60 border border-dashed">
                        Add images to sanity
                    </div>
                )}
            </div>
        </section>
    );
}
