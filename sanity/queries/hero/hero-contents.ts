// sanity/queries/hero-contents.ts
import { groq } from "next-sanity";

// @sanity-typegen-ignore
export const heroContentsQuery = groq`
  _type == "hero-contents" => {
    _type,
    _key,
    title,

    "showNumbers": coalesce(showNumbers, false),
    "showProjectDetails": coalesce(showProjectDetails, false),
    "linksLayout": coalesce(linksLayout, "grid"),

    "showScrollHint": coalesce(showScrollHint, false),

    "featuredLabel": coalesce(featuredLabel, ""),
    "featuredProject": select(
      defined(featuredProject) => featuredProject->{
        "title": coalesce(title, "Untitled"),
        "slug": slug.current
      },
      null
    ),

    "bio": select(
      defined(bio) => {
        "body": bio.body,
        "dropCap": coalesce(bio.dropCap, false),
        "links": coalesce(bio.links, [])[]{
          _key,
          "label": coalesce(label, ""),
          "href": coalesce(href, ""),
          "newTab": coalesce(newTab, false)
        }
      },
      null
    ),

    "showFooterText": coalesce(showFooterText, true),
    "footerBody": footerBody,
    "footerDropCap": coalesce(footerDropCap, false),

    "bottomLinks": coalesce(bottomLinks, [])[]{
      _key,
      "label": coalesce(label, ""),
      "href": coalesce(href, ""),
      "newTab": coalesce(newTab, false)
    },

    "copyrightText": coalesce(copyrightText, ""),

    "mobileItems": coalesce(mobileItems, [])[]{
      _key,
      "title": coalesce(title, ""),
      "image": select(
        defined(image) => {
          "asset": {"url": image.asset->url},
          "alt": image.alt
        },
        null
      )
    },

    "items": items[]{
      "title": coalesce(project->title, "Untitled"),
      "slug": project->slug.current,
      "year": project->year,
      "client": coalesce(project->client, ""),
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

      // new grid coords
      "col": col,
      "row": row,

      // legacy fallback (optional)
      "x": x,
      "y": y,
      _key
    }
  }
`;
