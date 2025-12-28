// lib/app-events.ts
export const APP_EVENTS = {
  HS_READY: "hs-ready",
  HOME_HS_RESTORED: "home-hs-restored",

  HERO_TRANSITION_DONE: "hero-transition-done",
  HERO_PAGE_HERO_SHOW: "hero-page-hero-show",

  IMAGES_PRELOADED: "images-preloaded",

  SCROLL_START: "app-scroll-start",
  SCROLL_END: "app-scroll-end",
} as const;
