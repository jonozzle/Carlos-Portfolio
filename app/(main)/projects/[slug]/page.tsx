// app/(main)/projects/[slug]/page.tsx
import { notFound } from "next/navigation";

import Blocks from "@/components/blocks";
import BlockTextSection from "@/components/project/block-text-section";
import HScrollerWrapper from "@/components/scroll/hscroller-wrapper";
import ProjectDetails from "@/components/project/project-details";
import HeroImage from "@/components/project/hero-image";
import ThemeSetter from "@/components/theme/theme-setter";
import { StylizedLabel } from "@/components/ui/stylised-label";
import {
    fetchSanityProjectBySlug,
    fetchSanityProjectsStaticParams,
} from "@/sanity/lib/fetch";

type Project = NonNullable<Awaited<ReturnType<typeof fetchSanityProjectBySlug>>>;

type ProjectPageProps = {
    params: Promise<{ slug: string }>;
};

function capSanityImage(url: string, maxW = 2000) {
    if (!url) return "";
    try {
        const u = new URL(url);
        // Sanity Image API params (safe even if your URL is already a transformed one)
        u.searchParams.set("auto", "format");
        u.searchParams.set("fit", "max");
        u.searchParams.set("q", "80");
        u.searchParams.set("w", String(maxW));
        return u.toString();
    } catch {
        // If URL parsing fails, fall back to original.
        return url;
    }
}

export async function generateMetadata({ params }: ProjectPageProps) {
    const { slug } = await params;
    const project = await fetchSanityProjectBySlug({ slug });
    if (!project) notFound();

    return {
        title: project.title ?? "Project",
        description: project.client ? `Client: ${project.client}` : undefined,
    };
}

export async function generateStaticParams() {
    const slugs = await fetchSanityProjectsStaticParams();
    return slugs.map((s) => ({ slug: s.slug }));
}

export default async function ProjectPage({ params }: ProjectPageProps) {
    const { slug } = await params;
    const project = (await fetchSanityProjectBySlug({ slug })) as Project | null;

    if (!project) notFound();

    const rawHeroSrc = project.featuredImage?.asset?.url ?? "";
    const heroSrc = capSanityImage(rawHeroSrc, 2000);
    const heroAlt = project.title ?? "Project image";

    // Pull aspect ratio from Sanity if present (prevents layout shifts during hero flight / scroll)
    const dims = (project as any)?.featuredImage?.asset?.metadata?.dimensions as
        | { width?: number; height?: number }
        | undefined;

    const heroAR =
        dims?.width && dims?.height && dims.width > 0 && dims.height > 0
            ? dims.width / dims.height
            : undefined;

    const details = (project.details ?? []).filter((d) => {
        const left = typeof d?.left === "string" ? d.left.trim() : "";
        const right = typeof d?.right === "string" ? d.right.trim() : "";
        return !!left || !!right;
    });
    const hasDetails = details.length > 0;
    const hasBlockText = Array.isArray(project.blockText?.body) && project.blockText.body.length > 0;

    return (
        <HScrollerWrapper>
            <ThemeSetter theme={project.theme ?? null} />

            <section data-panel-height="viewport" className="h-panel relative w-screen md:w-auto overflow-hidden">
                <div className="h-full flex flex-col md:flex-row md:items-stretch">
                    <div className="w-full md:w-[50vw] md:shrink-0 px-6 md:px-10" data-hero-page-animate>
                        <div className="h-full flex flex-col">
                            <div className="pt-6 md:pt-10 text-center">
                                <div className="text-sm md:text-base font-serif leading-tight tracking-tighter flex flex-col items-center">
                                    {project.year && <span className="mb-0 md:text-xl">{project.year}</span>}
                                    {project.client && <span className="">{project.client}</span>}
                                </div>
                            </div>

                            {hasDetails || hasBlockText ? (
                                <div className="mt-8 md:mt-10 px-6 flex flex-col gap-8">
                                    {hasDetails ? <ProjectDetails details={details} /> : null}
                                    {hasBlockText ? (
                                        <BlockTextSection
                                            body={project.blockText?.body ?? null}
                                            dropCap={project.blockText?.dropCap ?? null}
                                            showPageStartScrollLine={project.blockText?.showPageStartScrollLine ?? null}
                                            pageStartScrollLinePosition={project.blockText?.pageStartScrollLinePosition as "top" | "bottom" | null}
                                        />
                                    ) : null}
                                </div>
                            ) : null}

                            <div className="mt-18 md:mt-auto pb-6 md:pb-8 flex justify-center">
                                <h1 className="text-center text-[12vw] md:text-[9vw] font-serif font-medium leading-none tracking-tighter">
                                    <StylizedLabel text={project.title ?? "Untitled Project"} />
                                </h1>
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-auto md:shrink-0 px-6 md:px-6 py-6 md:py-6 h-auto md:h-full">
                        <HeroImage src={heroSrc} alt={heroAlt} slug={slug} autoWidth initialAR={heroAR} />
                    </div>
                </div>
            </section>

            <Blocks blocks={project.blocks ?? []} />
        </HScrollerWrapper>
    );
}
