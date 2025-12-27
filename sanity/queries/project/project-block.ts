// sanity/queries/project-block.ts
import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const projectBlockQuery = groq`
  _type == "project-block" => {
    _type,
    _key,
    title,
    width,
    projects[]{
      imageRowStart,
      imageRowEnd,
      imageColStart,
      imageColEnd,
      infoRowStart,
      infoRowEnd,
      infoColStart,
      infoColEnd,
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
