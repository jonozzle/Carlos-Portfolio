import { notFound } from "next/navigation";

import Blocks from "@/components/blocks";
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

            {/* md+: width can grow/shrink based on hero. mobile: viewport width. */}
            <section
                data-panel-height="viewport"
                className="h-panel relative w-screen md:w-auto overflow-hidden"
            >
                <div className="h-full flex flex-col md:flex-row md:items-stretch">
                    {/* LEFT: fixed 50vw on md+ */}
                    <div className="w-full md:w-[50vw] md:shrink-0 px-6 md:px-10" data-hero-page-animate>
                        <div className="h-full flex flex-col">
                            <div className="pt-6 md:pt-10 text-center">
                                <div className="text-sm md:text-base font-serif leading-tight tracking-tighter flex flex-col items-center">
                                    {project.year && <span className="mb-0 md:text-xl">{project.year}</span>}
                                    {project.client && <span className="italic">{project.client}</span>}
                                </div>
                            </div>

                            <div className="mt-8 md:mt-10">
                                <ProjectDetails details={project.details ?? []} />
                            </div>

                            <div className="mt-auto pb-6 md:pb-8 flex justify-center">
                                <h1 className="text-center text-[12vw] md:text-[9vw] font-serif font-medium leading-none tracking-tighter">
                                    <StylizedLabel text={project.title ?? "Untitled Project"} />
                                </h1>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: padded container so image isn't flush to edge */}
                    <div className="w-full md:w-auto md:shrink-0 px-6 md:px-6 py-6 md:py-6 h-auto md:h-full">
                        <HeroImage src={heroSrc} alt={heroAlt} slug={slug} autoWidth />
                    </div>
                </div>
            </section>

            <Blocks blocks={project.blocks ?? []} />
        </HScrollerWrapper>
    );
}
