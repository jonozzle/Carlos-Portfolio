// sanity/queries/footer.ts
import { groq } from "next-sanity";

export const FOOTER_QUERY = groq`
  *[_type == "footer"][0]{
    _id,
    title,
    copyright,
    rightBody,
    links[]{
      _key,
      label,
      href,
      newTab
    },
    images[]{
      _key,
      "url": asset->url,
      alt
    }
  }
`;
