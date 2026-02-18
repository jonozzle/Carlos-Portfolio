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
    { name: "mobile", title: "Mobile Slideshow" },
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
      name: "showProjectDetails",
      title: "Show project details",
      type: "boolean",
      initialValue: false,
      description: "Shows the project year under the title, then the client under the year.",
    }),

    defineField({
      name: "linksLayout",
      title: "Links layout",
      type: "string",
      initialValue: "grid",
      options: {
        list: [
          { title: "Grid placement (28×28)", value: "grid" },
          { title: "Centered list", value: "center" },
          { title: "Two-column list", value: "two-column" },
        ],
        layout: "radio",
      },
      description:
        "Grid placement uses Row/Col per item (28×28). Center/Two-column ignore grid coords and render a list layout instead.",
    }),

    // -----------------------
    // BIO (body only + drop cap + links)
    // -----------------------
    defineField({
      name: "bio",
      title: "Red block",
      type: "object",
      fieldset: "bio",
      icon: TypeIcon,
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({
          name: "showBioText",
          title: "Show bio text",
          type: "boolean",
          initialValue: true,
          description: "Turns the body copy inside the red block on/off.",
        }),
        defineField({
          name: "showBioLinks",
          title: "Show bio links",
          type: "boolean",
          initialValue: true,
          description: "Turns the link row inside the red block on/off.",
        }),
        defineField({
          name: "enableAnimation",
          title: "Enable animation",
          type: "boolean",
          initialValue: false,
          description: "When off, hover/click does not animate the red block.",
        }),
        defineField({
          name: "body",
          title: "Body",
          type: "array",
          of: [{ type: "block" }],
          hidden: ({ parent }) => parent?.showBioText === false,
          description: "Editable bio body text (title is intentionally not editable here).",
        }),
        defineField({
          name: "dropCap",
          title: "Drop cap",
          type: "boolean",
          initialValue: false,
          hidden: ({ parent }) => parent?.showBioText === false,
          description: "Applies a drop cap to the first text block.",
        }),
        defineField({
          name: "links",
          title: "Bio links",
          type: "array",
          hidden: ({ parent }) => parent?.showBioLinks === false,
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
          initialValue: [],
        }),
      ],
      preview: {
        select: { body: "body" },
        prepare({ body }) {
          const hasBody = Array.isArray(body) && body.length > 0;
          return { title: "Red block", subtitle: hasBody ? "Custom body" : "No body" };
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
      description: "Toggles the footer text block (the ‘footer bio’).",
    }),
    defineField({
      name: "footerBody",
      title: "Footer body",
      type: "array",
      fieldset: "footer",
      of: [{ type: "block" }],
      description: "Footer text content. If empty, nothing is rendered.",
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
      name: "bottomLinks",
      title: "Bottom links",
      type: "array",
      fieldset: "bottom",
      description: "Links shown in the bottom-right (e.g. Email, Instagram).",
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
      description: "Shown under the bottom links on the bottom-right. If empty, nothing renders.",
    }),

    defineField({
      name: "showScrollHint",
      title: "Show scroll hint",
      type: "boolean",
      initialValue: false,
      description: "Shows a subtle right-edge scroll indicator.",
    }),

    defineField({
      name: "showMobileScrollHint",
      title: "Show mobile scroll hint",
      type: "boolean",
      fieldset: "mobile",
      initialValue: true,
      description: "Shows a subtle down-pointing scroll indicator below the mobile footer links.",
    }),

    // -----------------------
    // MOBILE SLIDESHOW
    // -----------------------
    defineField({
      name: "mobileItems",
      title: "Mobile slideshow images",
      type: "array",
      fieldset: "mobile",
      description:
        "Used only on mobile for the hero image slideshow. Desktop project links are unaffected. If empty, desktop hero item images are used as fallback.",
      of: [
        defineField({
          name: "slide",
          title: "Slide",
          type: "object",
          fields: [
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              description: "Optional internal label for this mobile slide.",
            }),
            defineField({
              name: "image",
              title: "Image",
              type: "image",
              options: { hotspot: true },
              icon: ImageIcon,
              validation: (r) => r.required(),
            }),
          ],
          preview: {
            select: { title: "title", media: "image" },
            prepare({ title, media }) {
              return {
                title: title || "Mobile slide",
                media,
                subtitle: "Hero mobile slideshow image",
              };
            },
          },
        }),
      ],
      initialValue: [],
    }),

    // -----------------------
    // ITEMS
    // -----------------------
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

            // GRID placement (28×28)
            defineField({
              name: "col",
              title: "Grid column (1–28)",
              type: "number",
              initialValue: 14,
              validation: (r) => r.required().integer().min(1).max(28),
              description: "Column index in the 28×28 grid (used in Grid placement).",
            }),
            defineField({
              name: "row",
              title: "Grid row (1–28)",
              type: "number",
              initialValue: 14,
              validation: (r) => r.required().integer().min(1).max(28),
              description: "Row index in the 28×28 grid (used in Grid placement).",
            }),
          ],
          preview: {
            select: { title: "project.title", media: "image", col: "col", row: "row" },
            prepare({ title, media, col, row }) {
              return {
                title: title || "Untitled",
                media,
                subtitle:
                  typeof col === "number" && typeof row === "number"
                    ? `Grid: c${col} r${row}`
                    : "Hero item",
              };
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
