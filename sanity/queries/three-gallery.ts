// sanity/queries/three-gallery.ts
import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const threeGalleryQuery = groq`
  _type == "three-gallery" => {
    _type,
    _key,
    title,
    layout,
    "items": projects[]->{
      "slug": slug.current,
      title,
      client,
      year,
      "theme": {
    "bg": coalesce(theme.bg.hex, theme.bg),
    "text": coalesce(theme.text.hex, theme.text)
  },
      "image": select(
        defined(featuredImage) => {
          "asset": { "url": featuredImage.asset->url },
          "alt": featuredImage.alt
        },
        null
      )
    }
  }
`;
