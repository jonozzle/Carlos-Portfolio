// src: app/(main)/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Blocks from "@/components/blocks";
import BlockTextSection from "@/components/project/block-text-section";
import ProjectDetails from "@/components/project/project-details";
import HScrollerWrapper from "@/components/scroll/hscroller-wrapper";
import PageHeroImage from "@/components/page/page-hero-image";
import ThemeSetter from "@/components/theme/theme-setter";
import { StylizedLabel } from "@/components/ui/stylised-label";
import {
  fetchSanityPageBySlug,
  fetchSanityPagesStaticParams,
} from "@/sanity/lib/fetch";
import { generatePageMetadata } from "@/sanity/lib/metadata";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function capSanityImage(url: string, maxW = 2000) {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.searchParams.set("auto", "format");
    u.searchParams.set("fit", "max");
    u.searchParams.set("q", "80");
    u.searchParams.set("w", String(maxW));
    return u.toString();
  } catch {
    return url;
  }
}

export async function generateStaticParams() {
  const pages = await fetchSanityPagesStaticParams();

  return pages
    .map((p) => p.slug?.current)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0)
    .map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const page = await fetchSanityPageBySlug({ slug });
  if (!page) notFound();

  return generatePageMetadata({ page, slug });
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;

  const page = await fetchSanityPageBySlug({ slug });
  if (!page) notFound();

  const rawHeroSrc = page.featuredImage?.asset?.url ?? "";
  const heroSrc = capSanityImage(rawHeroSrc, 2000);
  const heroAlt = page.title ?? "Page image";

  // Optional aspect ratio reservation (won’t break if metadata is missing)
  const dims = (page as any)?.featuredImage?.asset?.metadata?.dimensions as
    | { width?: number; height?: number }
    | undefined;

  const heroAR =
    dims?.width && dims?.height && dims.width > 0 && dims.height > 0
      ? dims.width / dims.height
      : undefined;

  const details = (page.details ?? []).filter((d) => {
    const left = typeof d?.left === "string" ? d.left.trim() : "";
    const right = typeof d?.right === "string" ? d.right.trim() : "";
    return !!left || !!right;
  });
  const hasDetails = details.length > 0;
  const hasBlockText = Array.isArray(page.blockText?.body) && page.blockText.body.length > 0;

  return (
    <HScrollerWrapper>
      <ThemeSetter theme={page.theme ?? null} />

      <section
        data-panel-height="viewport"
        className="h-panel relative w-screen md:w-auto overflow-hidden"
      >
        <div className="h-full flex flex-col md:flex-row md:items-stretch">
          <div
            className="w-full md:w-[50vw] md:shrink-0 px-6 md:px-10"
            data-hero-page-animate
          >
            <div className="h-full flex flex-col">
              {hasDetails || hasBlockText ? (
                <div className="pt-6 md:pt-10 text-center" />
              ) : null}

              {hasDetails || hasBlockText ? (
                <div className="mt-8 md:mt-10 px-6 flex flex-col gap-8">
                  {hasDetails ? <ProjectDetails details={details} /> : null}
                  {hasBlockText ? (
                    <BlockTextSection
                      body={page.blockText?.body ?? null}
                      dropCap={page.blockText?.dropCap ?? null}
                      showPageStartScrollLine={page.blockText?.showPageStartScrollLine ?? null}
                      pageStartScrollLinePosition={page.blockText?.pageStartScrollLinePosition as "top" | "bottom" | null}
                    />
                  ) : null}
                </div>
              ) : null}

              <div className="mt-18 md:mt-auto pb-6 md:pb-8 flex justify-center">
                <h1 className="text-center text-[12vw] md:text-[9vw] font-serif font-medium leading-none tracking-tighter">
                  <StylizedLabel text={page.title ?? "Untitled Page"} />
                </h1>
              </div>
            </div>
          </div>

          <div
            className="w-full md:w-auto md:shrink-0 px-6 md:px-6 py-6 md:py-6 h-auto md:h-full"
            style={heroAR ? ({ aspectRatio: heroAR } as React.CSSProperties) : undefined}
          >
            <PageHeroImage src={heroSrc} alt={heroAlt} slug={slug} />
          </div>
        </div>
      </section>

      <Blocks blocks={page.blocks ?? []} />
    </HScrollerWrapper>
  );
}
