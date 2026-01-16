// sanity/queries/ad-section.ts
import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const adSectionQuery = groq`
  _type == "ad-section" => {
    _type,
    _key,
    title,
    orientation,
    parallaxEnabled,
    parallaxAmount,
    padded,
    padding,
    sectionWidth,
    horizontalAlign,
    verticalAlign,
    theme { bg, text },

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
