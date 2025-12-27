// sanity/queries/page.ts
import { groq } from "next-sanity";
import { imageQuery } from "./shared/image";
import { hero1Query } from "./hero/hero-1";
import { hero2Query } from "./hero/hero-2";
import { sectionHeaderQuery } from "./section-header";
import { splitRowQuery } from "./split/split-row";
import { gridRowQuery } from "./grid/grid-row";
import { carousel1Query } from "./carousel/carousel-1";
import { carousel2Query } from "./carousel/carousel-2";
import { timelineQuery } from "./timeline";
import { cta1Query } from "./cta/cta-1";
import { logoCloud1Query } from "./logo-cloud/logo-cloud-1";
import { faqsQuery } from "./faqs";
import { formNewsletterQuery } from "./forms/newsletter";
import { allPostsQuery } from "./all-posts";
import { heroContentsQuery } from "./hero/hero-contents";
import { threeGalleryQuery } from "./three-gallery";
import { adSectionQuery } from "./ads/ad-section";
import { halfWidthSingleProjectQuery } from "./half-width-single-project";
import { halfWidthDoubleProjectQuery } from "./half-width-double-project";
import { pageLinkSectionQuery } from "./page-link-section";
import { singleImageBlockQuery } from "./single-image";
import { projectBlockQuery } from "./project/project-block";

export const PAGE_QUERY = groq`
  *[_type == "page" && slug.current == $slug][0]{
    // Basic page info
    title,
    "slug": slug.current,

    // Page theme (used by PageThemeSetter)
    theme{bg, text},

    // Page-level featured image for hero
    featuredImage{ ${imageQuery} },

    blocks[]{
      ${hero1Query},
      ${hero2Query},
      ${threeGalleryQuery},
      ${heroContentsQuery},
      ${sectionHeaderQuery},
      ${splitRowQuery},
      ${gridRowQuery},
      ${carousel1Query},
      ${carousel2Query},
      ${timelineQuery},
      ${cta1Query},
      ${logoCloud1Query},
      ${faqsQuery},
      ${formNewsletterQuery},
      ${allPostsQuery},
      ${adSectionQuery},
      ${halfWidthSingleProjectQuery},
      ${halfWidthDoubleProjectQuery},
      ${pageLinkSectionQuery},
      ${singleImageBlockQuery},
      ${projectBlockQuery},
    },

    meta_title,
    meta_description,
    noindex,
    ogImage {
      asset->{
        _id,
        url,
        metadata {
          dimensions {
            width,
            height
          }
        }
      },
    }
  }
`;

export const PAGES_SLUGS_QUERY = groq`
  *[_type == "page" && defined(slug)]{
    slug
  }
`;
