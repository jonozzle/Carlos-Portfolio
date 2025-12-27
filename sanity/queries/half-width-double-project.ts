// sanity/queries/half-width-double-project.ts
import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const halfWidthDoubleProjectQuery = groq`
  _type == "half-width-double-project" => {
    _type,
    _key,
    title,
    projects[]{
      textPosition,
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
  }
`;


