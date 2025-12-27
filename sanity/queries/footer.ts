// sanity/queries/footer.ts
import { groq } from "next-sanity";


export const FOOTER_QUERY = groq`
  *[_type == "footer"][0]{
    _id,
    title,
    copyright,
    links[]{
      _key,
      label,
      href
    },
    images[]{
      _key,
      "url": asset->url,
      alt
    }
  }
`;
