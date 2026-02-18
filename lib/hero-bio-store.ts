import { useSyncExternalStore } from "react";

type HeroLink = {
  _key?: string;
  label?: string | null;
  href?: string | null;
  newTab?: boolean | null;
};

export type HeroBioData = {
  body?: any[] | null;
  dropCap?: boolean | null;
  links?: HeroLink[] | null;
  showBioText?: boolean | null;
  showBioLinks?: boolean | null;
  enableAnimation?: boolean | null;
};

type Listener = () => void;

let current: HeroBioData | null = null;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function setHeroBioData(next: HeroBioData | null) {
  current = next;
  notify();
}

export function clearHeroBioData() {
  setHeroBioData(null);
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return current;
}

export function useHeroBioData() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
