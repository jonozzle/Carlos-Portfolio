// src: sanity/queries/project-index-drawer.ts
import { groq } from "next-sanity";

// Singleton document query for the header drawer.
// @sanity-typegen-ignore
export const projectIndexDrawerQuery = groq`
  *[_type == "projectIndexDrawer"][0]{
    "title": coalesce(title, "Project Index"),
    "showNumbers": coalesce(showNumbers, false),
    "showProjectDetails": coalesce(showProjectDetails, true),

    "items": coalesce(items, [])[]{
      _key,

      "title": coalesce(project->title, "Untitled"),
      "slug": project->slug.current,
      "year": project->year,
      "client": coalesce(project->client, ""),

      "col": col,
      "row": row
    }
  }
`;
