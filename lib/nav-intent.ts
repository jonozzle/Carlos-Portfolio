// lib/nav-intent.ts
export type NavIntent =
  | { kind: "project-to-home"; restoreY: number }
  | { kind: "none" };

const KEY = "__navIntent";

export function setNavIntent(intent: NavIntent) {
  if (typeof window === "undefined") return;
  (window as any)[KEY] = intent;
}

export function peekNavIntent(): NavIntent {
  if (typeof window === "undefined") return { kind: "none" };
  return ((window as any)[KEY] as NavIntent | undefined) ?? { kind: "none" };
}

export function consumeNavIntent(): NavIntent {
  if (typeof window === "undefined") return { kind: "none" };
  const intent = peekNavIntent();
  (window as any)[KEY] = { kind: "none" } satisfies NavIntent;
  return intent;
}
