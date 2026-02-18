// sanity/queries/spacer.ts
import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const spacerBlockQuery = groq`
  _type == "spacer" => {
    _type,
    _key,
    desktopSize,
    mobileSize,
    size
  }
`;
