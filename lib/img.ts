// lib/img.ts
export function lowSrc(url?: string | null, w = 24) {
  if (!url) return "";
  const hasQ = url.includes("?");
  const sep = hasQ ? "&" : "?";
  return `${url}${sep}w=${w}&q=10&auto=format`;
}

export function highSrc(url?: string | null, maxWidth = 1800) {
  if (!url) return "";
  const hasQ = url.includes("?");
  const sep = hasQ ? "&" : "?";
  // cap width; let CDN downscale & compress
  return `${url}${sep}w=${maxWidth}&auto=format`;
}
