// sanity/queries/page-link-section.ts
import { groq } from "next-sanity";
import { imageQuery } from "./shared/image";

// @sanity-typegen-ignore
export const pageLinkSectionQuery = groq`
  _type == "page-link-section" => {
    _type,
    _key,
    title,
    width,
    paddingMode,
    customPadding,
    "items": items[]{
      _key,
      label,
      subline,
      externalUrl,
      textPosition,
      // expand the referenced page
      "page": page->{
        "slug": slug.current,
        title,
        theme{bg, text},
        featuredImage{ ${imageQuery} },
      },
      // resolved image used by the block
      "image": select(
        defined(image) => {
          ${imageQuery}
        },
        defined(page->featuredImage) => {
          "asset": { "url": page->featuredImage.asset->url },
          "alt": page->featuredImage.alt
        },
        null
      )
    }
  }
`;
