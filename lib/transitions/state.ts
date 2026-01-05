// transitions/state
// lib/transitions/state.ts
export type PageDirection = "up" | "down";
export type PageTransitionKind = "hero" | "fadeHero" | "simple";

export type PageTransitionPending = {
    direction: PageDirection;
    fromPath: string;
    kind: PageTransitionKind;

    homeSectionId?: string | null;
    homeSectionType?: string | null;
};

export type PendingHero = {
    slug: string;
    overlay: HTMLDivElement;

    targetEl?: HTMLElement | null;
    overlayImg?: HTMLImageElement | null;
};

declare global {
    interface Window {
        __pageTransitionPending?: PageTransitionPending;
        __pageTransitionLast?: PageTransitionKind;
        __heroPending?: PendingHero;

        __pageEnterSkipInitial?: boolean;

        __homeHsRestored?: boolean;

        // NEW: sticky “did the user scroll on this route?”
        __routeHasScrolled?: boolean;
    }
}
