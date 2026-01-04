// transitions/state
// lib/transitions/state.ts
export type PageDirection = "up" | "down";
export type PageTransitionKind = "hero" | "fadeHero" | "simple";

export type PageTransitionPending = {
    direction: PageDirection;
    fromPath: string;
    kind: PageTransitionKind;

    // HOME section snapshot (section-id based)
    homeSectionId?: string | null;
    homeSectionType?: string | null;
};

export type PendingHero = {
    slug: string;
    overlay: HTMLDivElement;

    // for "parkThenPage" mode
    targetEl?: HTMLElement | null;

    // optional: preserves hover-scale and eases back to 1 during flight
    overlayImg?: HTMLImageElement | null;
};

declare global {
    interface Window {
        __pageTransitionPending?: PageTransitionPending;
        __pageTransitionLast?: PageTransitionKind;
        __heroPending?: PendingHero;

        // used to skip entry fade when your loader handles it
        __pageEnterSkipInitial?: boolean;

        // HOME restoration marker
        __homeHsRestored?: boolean;
    }
}
