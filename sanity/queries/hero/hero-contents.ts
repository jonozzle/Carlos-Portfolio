import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const heroContentsQuery = groq`
  _type == "hero-contents" => {
    _type,
    _key,
    title,
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
      "overlayImage": select(
        defined(overlayImage) => {
          "asset": {"url": overlayImage.asset->url},
          "alt": overlayImage.alt
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
