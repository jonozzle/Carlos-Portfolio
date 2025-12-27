// lib/predecode.ts  (for reference)

export function predecodeNextImages(scope: HTMLElement, count = 4) {
  // IMPORTANT:
  // img.decode() is optional and can reject in normal situations (navigation, aborted load, etc)
  // causing “The source image cannot be decoded.” noise.
  // We intentionally do NOT call decode() anymore.
  void scope;
  void count;
}
