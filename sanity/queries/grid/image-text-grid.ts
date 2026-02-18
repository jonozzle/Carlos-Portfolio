// sanity/queries/image-text-grid.ts
import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const imageTextGridQuery = groq`
  _type == "image-text-grid" => {
    _type,
    _key,
    paddingMode,
    paddingSideOverrides,
    widthMode,
    showScrollLine,
    items[]{
      _type,
      _key,
      rowStart,
      rowEnd,
      colStart,
      colEnd,

      _type == "image-text-grid-image" => {
        _type,
        _key,
        rowStart,
        rowEnd,
        colStart,
        colEnd,
        withColorBlock,
        caption,
        "image": select(
          defined(image) => {
            "asset": {
              "url": image.asset->url,
              "width": image.asset->metadata.dimensions.width,
              "height": image.asset->metadata.dimensions.height
            },
            "alt": image.alt
          },
          null
        )
      },

      _type == "image-text-grid-text" => {
        _type,
        _key,
        usePresetPosition,
        presetX,
        presetY,
        presetWidth,
        rowStart,
        rowEnd,
        colStart,
        colEnd,
        mobilePaddingX,
        mobilePaddingY,
        dropCap,
        body
      }
    }
  }
`;
