// app/(main)/[slug]/page.tsx

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Blocks from "@/components/blocks";
import HScrollerWrapper from "@/components/hscroller-wrapper";
import {
  fetchSanityPageBySlug,
  fetchSanityPagesStaticParams,
} from "@/sanity/lib/fetch";
import { generatePageMetadata } from "@/sanity/lib/metadata";
import PageHeroImage from "@/components/page/page-hero-image";
import PageThemeSetter from "@/components/page-theme-setter";
import { StylizedLabel } from "@/components/ui/stylised-label";

type PageProps = {
  // Next.js 15+ passes params as a Promise in App Router
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const pages = await fetchSanityPagesStaticParams();

  return pages
    .map((p) => p.slug?.current)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0)
    .map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const page = await fetchSanityPageBySlug({ slug });
  if (!page) notFound();

  return generatePageMetadata({ page, slug });
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;

  const page = await fetchSanityPageBySlug({ slug });
  if (!page) notFound();

  const heroSrc = page.featuredImage?.asset?.url ?? "";
  const heroAlt = page.title ?? "Page image";

  return (
    <HScrollerWrapper>
      {/* Lock theme for this page */}
      <PageThemeSetter theme={page.theme ?? null} />

      {/* HERO PANEL – mark the column content as hero-page-animate */}
      <section className="h-panel w-screen relative">
        <div className="grid grid-cols-1 md:grid-cols-2 h-full">
          {/* LEFT COLUMN – hero-page-animate */}
          <div className="px-6 md:px-10" data-hero-page-animate>
            <div className="h-full flex flex-col">
              <div className="pt-6 md:pt-10 text-center" />
              <div className="mt-auto pb-6 md:pb-8 flex justify-center">
                <h1 className="text-center text-2xl md:text-[9vw] font-serif font-normal leading-none tracking-tighter">
                  <StylizedLabel text={page.title ?? "Untitled Page"} />
                </h1>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN – hero image target (not animated by page-enter-shell) */}
          <div className="py-6">
            <PageHeroImage src={heroSrc} alt={heroAlt} slug={slug} />
          </div>
        </div>
      </section>

      {/* BODY – also part of hero-page-animate */}
      <div data-hero-page-animate>
        <Blocks blocks={page.blocks ?? []} />
      </div>
    </HScrollerWrapper>
  );
}
