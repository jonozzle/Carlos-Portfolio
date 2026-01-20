// src: sanity/queries/ad-section.ts
import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const adSectionQuery = groq`
  _type == "ad-section" => {
    _type,
    _key,
    title,
    theme { bg, text },

    desktop{
      orientation,
      parallaxEnabled,
      parallaxAmount,
      sectionWidth
    },

    mobile{
      orientation,
      parallaxEnabled,
      parallaxAmount,
      height
    },

    "images": images[]{
      "asset": {
        "url": asset->url,
        "width": asset->metadata.dimensions.width,
        "height": asset->metadata.dimensions.height
      },
      alt
    }
  }
`;
