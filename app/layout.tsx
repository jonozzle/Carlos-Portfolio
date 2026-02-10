// RootLayout
// app/layout.tsx
import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import { corporateAPro, fontVars } from "./fonts";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ViewTransitions } from "next-view-transitions";
import { LoaderProvider } from "@/components/loader/loader-context";


const isProduction = process.env.NEXT_PUBLIC_SITE_ENV === "production";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL!),
  title: {
    template: "%s | Carlos Castrosin",
    default: "Carlos Castrosin | Photographer",
  },
  openGraph: {
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_SITE_URL}/images/og-image.jpg`,
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  robots: !isProduction ? "noindex, nofollow" : "index, follow",
  icons: { icon: "/favicon.ico" },
};

const fontSans = FontSans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased overscroll-none has-custom-cursor",
          fontSans.variable,
          fontVars
        )}
      >
        <ViewTransitions>
          <LoaderProvider>
            <ThemeProvider>
              {children}
              <Toaster />
            </ThemeProvider>
          </LoaderProvider>
        </ViewTransitions>
      </body>
    </html>
  );
}
