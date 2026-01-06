// app/(main)/projects/[slug]/page.tsx
import { notFound } from "next/navigation";

import Blocks from "@/components/blocks";
import HScrollerWrapper from "@/components/scroll/hscroller-wrapper";
import ProjectDetails from "@/components/project/project-details";
import HeroImage from "@/components/project/hero-image";
import ThemeSetter from "@/components/theme/theme-setter";
import { StylizedLabel } from "@/components/ui/stylised-label";
import BackToHomeButton from "@/components/project/back-to-home";
import {
    fetchSanityProjectBySlug,
    fetchSanityProjectsStaticParams,
} from "@/sanity/lib/fetch";

type Project = NonNullable<Awaited<ReturnType<typeof fetchSanityProjectBySlug>>>;

type ProjectPageProps = {
    params: Promise<{ slug: string }>;
};

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

    const heroSrc = project.featuredImage?.asset?.url ?? "";
    const heroAlt = project.title ?? "Project image";

    return (
        <HScrollerWrapper>
            <ThemeSetter theme={project.theme ?? null} />

            <section data-panel-height="viewport" className="h-panel w-screen relative">
                <div className="grid grid-cols-1 md:grid-cols-2 h-full">
                    <div className="px-6 md:px-10" data-hero-page-animate>
                        <div className="h-full flex flex-col">
                            <div className="pt-6 md:pt-10 text-center">
                                <div className="text-sm md:text-base font-serif leading-tight tracking-tighter flex flex-col items-center">
                                    {project.year && <span className="mb-0 md:text-xl">{project.year}</span>}
                                    {project.client && <span className="italic">{project.client}</span>}

                                    {/*<BackToHomeButton slug={slug} heroImgUrl={heroSrc} /> */}
                                </div>
                            </div>

                            <div className="mt-8 md:mt-10">
                                <ProjectDetails details={project.details ?? []} />
                            </div>

                            <div className="mt-auto pb-6 md:pb-8 flex justify-center">
                                <h1 className="text-center text-2xl md:text-[9vw] font-serif font-medium leading-none tracking-tighter">
                                    <StylizedLabel text={project.title ?? "Untitled Project"} />
                                </h1>
                            </div>
                        </div>
                    </div>

                    <div className="py-6">
                        <HeroImage src={heroSrc} alt={heroAlt} slug={slug} />
                    </div>
                </div>
            </section>


            <Blocks blocks={project.blocks ?? []} />

        </HScrollerWrapper>
    );
}
