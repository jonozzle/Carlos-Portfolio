// lib/transitions/state.ts

export type PageDirection = "up" | "down";

export type PageTransitionPending = {
    direction: PageDirection;
    // store scroll so "down" (back home) can restore precisely
    fromPath: string;
    scrollTop: number;
};

export type PendingHero = {
    slug: string;
    overlay: HTMLDivElement;
    // for "parkThenPage" mode
    targetEl?: HTMLElement | null;
};

declare global {
    interface Window {
        __pageTransitionPending?: PageTransitionPending;
        __heroPending?: PendingHero;

        // used to skip entry fade when your loader handles it
        __pageEnterSkipInitial?: boolean;
    }
}
