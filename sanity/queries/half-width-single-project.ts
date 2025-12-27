// sanity/queries/half-width-single-project.ts
import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const halfWidthSingleProjectQuery = groq`
  _type == "half-width-single-project" => {
    _type,
    _key,
    title,
    "project": project->{
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

