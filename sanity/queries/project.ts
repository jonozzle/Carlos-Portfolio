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
import { allPostsQuery } from "./all-posts";
import { singleImageBlockQuery } from "./single-image";
import { spacerBlockQuery } from "./spacer";
import { imageTextGridQuery } from "./grid/image-text-grid";

export const PROJECT_QUERY = groq`
*[_type == "project" && slug.current == $slug][0]{
  title,
  year,
  client,

  "theme": {
    "bg": coalesce(theme.bg.hex, theme.bg),
    "text": coalesce(theme.text.hex, theme.text)
  },

  featuredImage{
    ${imageQuery}
  },

  details[]{
    left,
    right
  },

  blocks[]{
    ${hero1Query},
    ${hero2Query},
    ${sectionHeaderQuery},
    ${splitRowQuery},
    ${gridRowQuery},
    ${carousel1Query},
    ${carousel2Query},
    ${timelineQuery},
    ${cta1Query},
    ${logoCloud1Query},
    ${faqsQuery},
    ${allPostsQuery},
    ${singleImageBlockQuery},
    ${spacerBlockQuery},
    ${imageTextGridQuery},
  }
}
`;

export const PROJECTS_SLUGS_QUERY = groq`
*[_type == "project" && defined(slug.current)]{
  "slug": slug.current
}
`;
