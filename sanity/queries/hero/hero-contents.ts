// sanity/queries/hero-contents.ts
import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const heroContentsQuery = groq`
  _type == "hero-contents" => {
    _type,
    _key,
    title,

    "showNumbers": coalesce(showNumbers, false),
    "linksLayout": coalesce(linksLayout, "custom"),

    "showBottomDivider": coalesce(showBottomDivider, true),
    "bottomLayout": coalesce(bottomLayout, "justified"),
    "showScrollHint": coalesce(showScrollHint, false),

    "featuredLabel": coalesce(featuredLabel, ""),
    "featuredProject": select(
      defined(featuredProject) => featuredProject->{
        "title": coalesce(title, "Untitled"),
        "slug": slug.current
      },
      null
    ),

    "items": items[]{
      "title": coalesce(project->title, "Untitled"),
      "slug": project->slug.current,
      "year": project->year,
      "image": select(
        defined(image) => {
          "asset": {"url": image.asset->url},
          "alt": image.alt
        },
        defined(project->featuredImage) => {
          "asset": {"url": project->featuredImage.asset->url},
          "alt": project->featuredImage.alt
        },
        null
      ),
      "x": x,
      "y": y,
      "layout": coalesce(layout, "feature-left"),
      _key
    }
  }
`;
