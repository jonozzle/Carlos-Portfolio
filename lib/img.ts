// lib/img.ts
export function lowSrc(url?: string | null, w = 24) {
  if (!url) return "";
  const hasQ = url.includes("?");
  const sep = hasQ ? "&" : "?";
  return `${url}${sep}w=${w}&q=10&auto=format`;
}

export function highSrc(url?: string | null, maxWidth = 1800, quality?: number | null) {
  if (!url) return "";
  const hasQ = url.includes("?");
  const sep = hasQ ? "&" : "?";
  const safeWidth = Number.isFinite(maxWidth) ? Math.max(1, Math.round(maxWidth)) : 1800;
  const safeQuality =
    typeof quality === "number" && Number.isFinite(quality)
      ? Math.min(100, Math.max(1, Math.round(quality)))
      : null;
  // cap width; let CDN downscale & compress
  return `${url}${sep}w=${safeWidth}${safeQuality ? `&q=${safeQuality}` : ""}&auto=format`;
}
