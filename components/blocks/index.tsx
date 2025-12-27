//components/blocks/index.tsx
import { PAGE_QUERYResult } from "@/sanity.types";
import Hero1 from "@/components/blocks/hero/hero-1";
import Hero2 from "@/components/blocks/hero/hero-2";
import SectionHeader from "@/components/blocks/section-header";
import SplitRow from "@/components/blocks/split/split-row";
import GridRow from "@/components/blocks/grid/grid-row";
import Carousel1 from "@/components/blocks/carousel/carousel-1";
import Carousel2 from "@/components/blocks/carousel/carousel-2";
import TimelineRow from "@/components/blocks/timeline/timeline-row";
import Cta1 from "@/components/blocks/cta/cta-1";
import LogoCloud1 from "@/components/blocks/logo-cloud/logo-cloud-1";
import FAQs from "@/components/blocks/faqs";
import FormNewsletter from "@/components/blocks/forms/newsletter";
import AllPosts from "@/components/blocks/all-posts";
import HeroContents from "@/components/blocks/hero/hero-contents";
import ThreeGallery from "@/components/blocks/project/three-gallery";
import HalfWidthSingleProject from "@/components/blocks/project/half-width-single-project";
import HalfWidthDoubleProject from "@/components/blocks/project/half-width-double-project";
import AdSection from "@/components/ads/ad-section";
import PageLinkSection from "./page-link-section";
import SingleImage from "./single-image";
import ProjectBlock from "./project/project-block";

type Block = NonNullable<NonNullable<PAGE_QUERYResult>["blocks"]>[number];

const componentMap: {
  [K in Block["_type"]]: React.ComponentType<Extract<Block, { _type: K }>>;
} = {

  "hero-1": Hero1,
  "hero-2": Hero2,
  "hero-contents": HeroContents,
  "section-header": SectionHeader,
  "split-row": SplitRow,
  "grid-row": GridRow,
  "carousel-1": Carousel1,
  "carousel-2": Carousel2,
  "timeline-row": TimelineRow,
  "cta-1": Cta1,
  "logo-cloud-1": LogoCloud1,
  faqs: FAQs,
  "form-newsletter": FormNewsletter,
  "all-posts": AllPosts,
  "three-gallery": ThreeGallery,
  "ad-section": AdSection,
  "half-width-single-project": HalfWidthSingleProject,
  "half-width-double-project": HalfWidthDoubleProject,
  "page-link-section": PageLinkSection,
  "single-image": SingleImage,
  "project-block": ProjectBlock,

};

// components/blocks/index.tsx
export default function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks?.map((block) => {
        const Component = componentMap[block._type as keyof typeof componentMap];
        if (!Component) {
          console.warn(`No component implemented for block type: ${block._type}`);
          return <div data-type={block._type} key={block._key} />;
        }

        return (
          <div
            key={block._key}
            className="flex-none  h-[100vh] will-change-transform transform-gpu"

          >
            <Component {...(block as any)} />
          </div>
        );
      })}
    </>
  );
}

