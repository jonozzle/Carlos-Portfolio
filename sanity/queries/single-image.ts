// sanity/queries/single-image.ts
import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const singleImageBlockQuery = groq`
  _type == "single-image" => {
    _type,
    _key,
    paddingMode,
    paddingSideOverrides,
    widthMode,

    caption,
    captionPosition,
    "captionColor": captionColor { hex, alpha, rgb },

    "image": select(
      defined(image) => {
        "asset": {
          "url": image.asset->url,
          // Only if you want dimensions for aspect-ratio optimisation
          "width": image.asset->metadata.dimensions.width,
          "height": image.asset->metadata.dimensions.height
        },
        "alt": coalesce(image.alt, image.asset->altText, "")
      },
      null
    )
  }
`;
