// lib/app-events.ts
export const APP_EVENTS = {
  HS_READY: "hs-ready",
  HOME_HS_RESTORED: "home-hs-restored",

  HERO_TRANSITION_DONE: "hero-transition-done",
  HERO_PAGE_HERO_SHOW: "hero-page-hero-show",

  IMAGES_PRELOADED: "images-preloaded",

  SCROLL_START: "app-scroll-start",
  SCROLL_END: "app-scroll-end",

  // hard scroll lock during transitions
  APP_SCROLL_LOCK: "app-scroll-lock",
  APP_SCROLL_UNLOCK: "app-scroll-unlock",

  NAV_START: "app-nav-start",
  NAV_END: "app-nav-end",

  // UI reveal / FOUC gating helpers
  UI_CURSOR_SHOW: "ui-cursor-show",
  UI_CURSOR_HIDE: "ui-cursor-hide",
  UI_BOOKMARK_SHOW: "ui-bookmark-show",
  UI_BOOKMARK_HIDE: "ui-bookmark-hide",
} as const;
