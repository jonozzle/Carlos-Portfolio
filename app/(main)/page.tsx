// app/(main)/page.tsx
import Blocks from "@/components/blocks";
import HScrollerWrapper from "@/components/scroll/hscroller-wrapper";
import { fetchSanityPageBySlug, fetchSanityFooter } from "@/sanity/lib/fetch";
import { generatePageMetadata } from "@/sanity/lib/metadata";
import { notFound } from "next/navigation";
import ThemeSetter from "@/components/theme/theme-setter";
import HomeFooter from "@/components/footer/home-footer";

export async function generateMetadata() {
  const page = await fetchSanityPageBySlug({ slug: "index" });
  if (!page) notFound();
  return generatePageMetadata({ page, slug: "index" });
}

export default async function IndexPage() {
  const [page, footer] = await Promise.all([
    fetchSanityPageBySlug({ slug: "index" }),
    fetchSanityFooter(),
  ]);

  if (!page) notFound();

  return (
    <>
      <ThemeSetter reset />

      <div data-hero-page-animate>
        <HScrollerWrapper>
          <Blocks blocks={page.blocks ?? []} />
          {footer && <HomeFooter footer={footer} />}
        </HScrollerWrapper>
      </div>
    </>
  );
}
