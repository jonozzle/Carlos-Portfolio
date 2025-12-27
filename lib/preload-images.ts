// lib/preload-images.ts

type Options = {
  concurrency?: number;
  timeoutMs?: number;
  onProgress?: (loaded: number, total: number) => void;
};

function decodeImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve();

    const img = new Image();
    (img as any).decoding = "async";
    img.src = url;

    const done = () => resolve();

    if ("decode" in img && typeof (img as any).decode === "function") {
      (img as any).decode().then(done).catch(done);
    } else {
      img.onload = done;
      img.onerror = done;
    }
  });
}

export async function preloadAndDecodeImages(urls: string[], opts?: Options) {
  if (typeof window === "undefined") return;

  const concurrency = opts?.concurrency ?? 6;
  const timeoutMs = opts?.timeoutMs ?? 15000;
  const onProgress = opts?.onProgress;

  const list = Array.from(new Set(urls.filter(Boolean)));
  const total = list.length;

  let loaded = 0;
  const tick = () => onProgress?.(loaded, total);

  const withTimeout = (p: Promise<void>) =>
    new Promise<void>((resolve) => {
      const id = window.setTimeout(() => resolve(), timeoutMs);
      p.then(() => {
        clearTimeout(id);
        resolve();
      }).catch(() => {
        clearTimeout(id);
        resolve();
      });
    });

  tick();

  let i = 0;
  const worker = async () => {
    while (i < total) {
      const idx = i++;
      await withTimeout(decodeImage(list[idx]));
      loaded++;
      tick();
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, total) }, worker);
  await Promise.all(workers);
}
