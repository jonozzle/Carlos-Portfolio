// app/fonts.ts
import localFont from "next/font/local";

export const corporateAPro = localFont({
  src: [
    // Roman
    { path: "../public/fonts/CorporateAPro-Light.woff2", weight: "300", style: "normal" },
    { path: "../public/fonts/CorporateAPro-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/CorporateAPro-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/CorporateAPro-Demi.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/CorporateAPro-Bold.woff2", weight: "700", style: "normal" },

    // Italic
    { path: "../public/fonts/CorporateAPro-Lightitalic.woff2", weight: "300", style: "italic" },
    { path: "../public/fonts/CorporateAPro-Regularitalic.woff2", weight: "400", style: "italic" },
    { path: "../public/fonts/CorporateAPro-Mediumitalic.woff2", weight: "500", style: "italic" },
    { path: "../public/fonts/CorporateAPro-Demiitalic.woff2", weight: "600", style: "italic" },
    { path: "../public/fonts/CorporateAPro-Bolditalic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-serif",
  preload: true,
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Georgia", "Times New Roman", "Times", "serif"],
});

// Helper to apply all vars on <html> or <body>
export const fontVars = [corporateAPro.variable].join(" ");
