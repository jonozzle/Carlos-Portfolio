// sanity/schemas/blocks/hero/hero-contents.ts
import { defineType, defineField } from "sanity";
import {
  LayoutTemplate,
  Image as ImageIcon,
  Link as LinkIcon,
  Type as TypeIcon,
} from "lucide-react";

export default defineType({
  name: "hero-contents",
  title: "Hero Contents",
  type: "object",
  icon: LayoutTemplate,
  fieldsets: [
    { name: "bio", title: "Bio" },
    { name: "footer", title: "Footer Text" },
    { name: "bottom", title: "Bottom" },
  ],
  fields: [
    defineField({
      name: "title",
      type: "string",
      description: "Optional heading",
    }),

    defineField({
      name: "featuredLabel",
      title: "Featured label",
      type: "string",
      description:
        "Label shown before the featured project link (e.g. 'Latest Project'). If empty, the whole featured row is hidden.",
    }),

    defineField({
      name: "featuredProject",
      title: "Featured project",
      type: "reference",
      to: [{ type: "project" }],
      icon: LinkIcon,
      description:
        "Optional single project shown in the header. If unset, the component can fall back to the first hero item.",
    }),

    defineField({
      name: "showNumbers",
      title: "Show numbering",
      type: "boolean",
      initialValue: false,
      description: "Adds an index number to the left of each link title.",
    }),

    defineField({
      name: "linksLayout",
      title: "Links layout",
      type: "string",
      initialValue: "custom",
      options: {
        list: [
          { title: "Custom placement (use X/Y per item)", value: "custom" },
          { title: "Centered list", value: "center" },
          { title: "Two-column list", value: "two-column" },
        ],
        layout: "radio",
      },
      description:
        "Default is Custom placement. Choose Center or Two-column to ignore X/Y and render a list layout instead.",
    }),

    // -----------------------
    // BIO (body only + drop cap + links)
    // -----------------------
    defineField({
      name: "bio",
      title: "Bio",
      type: "object",
      fieldset: "bio",
      icon: TypeIcon,
      fields: [
        defineField({
          name: "body",
          title: "Body",
          type: "array",
          of: [{ type: "block" }],
          description: "Editable bio body text (title is intentionally not editable here).",
        }),
        defineField({
          name: "dropCap",
          title: "Drop cap",
          type: "boolean",
          initialValue: false,
          description: "Applies a drop cap to the first text block.",
        }),
        defineField({
          name: "links",
          title: "Bio links",
          type: "array",
          of: [
            {
              type: "object",
              name: "heroBioLink",
              title: "Link",
              icon: LinkIcon,
              fields: [
                defineField({
                  name: "label",
                  title: "Label",
                  type: "string",
                  validation: (r) => r.required(),
                }),
                defineField({
                  name: "href",
                  title: "URL / mailto / tel",
                  type: "url",
                  description: "Examples: https://…, mailto:hello@…, tel:+41…, /projects/slug",
                  validation: (r) =>
                    r.required().uri({
                      allowRelative: true,
                      scheme: ["http", "https", "mailto", "tel"],
                    }),
                }),
                defineField({
                  name: "newTab",
                  title: "Open in new tab",
                  type: "boolean",
                  initialValue: false,
                }),
              ],
              preview: {
                select: { title: "label", subtitle: "href" },
              },
            },
          ],
        }),
      ],
      preview: {
        select: { body: "body" },
        prepare({ body }) {
          const hasBody = Array.isArray(body) && body.length > 0;
          return { title: "Bio", subtitle: hasBody ? "Custom body" : "No body" };
        },
      },
    }),

    // -----------------------
    // FOOTER TEXT (toggle + drop cap)
    // -----------------------
    defineField({
      name: "showFooterText",
      title: "Show footer text",
      type: "boolean",
      fieldset: "footer",
      initialValue: true,
      description: "Toggles the text block above the bottom divider/links.",
    }),
    defineField({
      name: "footerBody",
      title: "Footer body",
      type: "array",
      fieldset: "footer",
      of: [{ type: "block" }],
      description: "Footer text content shown in the right column. If empty, nothing is rendered.",
    }),
    defineField({
      name: "footerDropCap",
      title: "Footer drop cap",
      type: "boolean",
      fieldset: "footer",
      initialValue: false,
      description: "Applies a drop cap to the first footer text block.",
    }),

    // -----------------------
    // BOTTOM
    // -----------------------
    defineField({
      name: "showBottomDivider",
      title: "Show bottom divider line",
      type: "boolean",
      initialValue: true,
      description: "Toggles the horizontal divider above the bottom actions/copyright.",
    }),

    defineField({
      name: "bottomLayout",
      title: "Bottom layout",
      type: "string",
      fieldset: "bottom",
      initialValue: "justified",
      options: {
        list: [
          { title: "Justified (links left, copyright right)", value: "justified" },
          { title: "Center (links centered, copyright below)", value: "center" },
        ],
        layout: "radio",
      },
      description: "Controls layout of the footer actions/copyright area.",
    }),

    defineField({
      name: "bottomLinks",
      title: "Bottom links",
      type: "array",
      fieldset: "bottom",
      description: "Links shown at the bottom (e.g. Email, Instagram). If empty, nothing is rendered.",
      of: [
        {
          type: "object",
          name: "heroBottomLink",
          title: "Link",
          icon: LinkIcon,
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "href",
              title: "URL / mailto / tel",
              type: "url",
              description: "Examples: https://…, mailto:hello@…, tel:+41…, /projects/slug",
              validation: (r) =>
                r.required().uri({
                  allowRelative: true,
                  scheme: ["http", "https", "mailto", "tel"],
                }),
            }),
            defineField({
              name: "newTab",
              title: "Open in new tab",
              type: "boolean",
              initialValue: false,
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "href" },
          },
        },
      ],
      initialValue: [],
    }),

    defineField({
      name: "copyrightText",
      title: "Copyright text",
      type: "string",
      fieldset: "bottom",
      description: "If empty, nothing is rendered (no default year/©).",
    }),

    defineField({
      name: "showScrollHint",
      title: "Show scroll hint",
      type: "boolean",
      initialValue: false,
      description: "Shows a subtle right-edge scroll indicator (animated line extension).",
    }),

    defineField({
      name: "items",
      title: "Hero Projects",
      type: "array",
      of: [
        defineField({
          name: "item",
          title: "Item",
          type: "object",
          fields: [
            defineField({
              name: "project",
              title: "Project",
              type: "reference",
              to: [{ type: "project" }],
              validation: (r) => r.required(),
            }),
            defineField({
              name: "image",
              title: "Override Image",
              type: "image",
              options: { hotspot: true },
              icon: ImageIcon,
              description: "Optional. Falls back to project.featuredImage.",
            }),
            defineField({
              name: "layout",
              title: "Layout / Animation",
              type: "string",
              options: {
                list: [
                  { title: "Feature Left (corner clip)", value: "feature-left" },
                  { title: "Feature Right (reversed clip)", value: "feature-right" },
                  { title: "Center Overlay (fade / scale)", value: "center-overlay" },
                ],
                layout: "radio",
              },
              initialValue: "feature-left",
              description: "Controls layout/animation for this project when active.",
            }),
            defineField({
              name: "x",
              title: "X position (%)",
              type: "number",
              validation: (r) => r.min(0).max(100),
              description: "0–100. Used only in Custom placement.",
            }),
            defineField({
              name: "y",
              title: "Y position (%)",
              type: "number",
              validation: (r) => r.min(0).max(100),
              description: "0–100. Used only in Custom placement.",
            }),
          ],
          preview: {
            select: { title: "project.title", media: "image" },
            prepare({ title, media }) {
              return { title: title || "Untitled", media, subtitle: "Hero item" };
            },
          },
        }),
      ],
      validation: (r) => r.min(1).max(100),
    }),
  ],
  preview: {
    select: { title: "title", featuredLabel: "featuredLabel" },
    prepare({ title, featuredLabel }) {
      return {
        title: "Hero Contents",
        subtitle: featuredLabel ? `Featured: ${featuredLabel}` : title || "Selected projects",
      };
    },
  },
});
