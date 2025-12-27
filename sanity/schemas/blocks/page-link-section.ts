// schemas/blocks/page-link-section.ts
import { defineField, defineType } from "sanity";
import { Link as LinkIcon } from "lucide-react";

export default defineType({
  name: "page-link-section",
  title: "Page Link Section",
  type: "object",
  icon: LinkIcon,
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Section title",
    }),

    // NEW: layout controls
    defineField({
      name: "width",
      type: "string",
      title: "Section width",
      description: "How wide this section should be in the horizontal scroller.",
      options: {
        list: [
          { title: "Full width (100vw)", value: "full" },
          { title: "Half width (50vw)", value: "half" },
        ],
        layout: "radio",
      },
      initialValue: "full",
    }),

    defineField({
      name: "paddingMode",
      type: "string",
      title: "Padding",
      options: {
        list: [
          { title: "No padding", value: "none" },
          { title: "Default padding", value: "default" },
          { title: "Custom padding", value: "custom" },
        ],
        layout: "radio",
      },
      initialValue: "default",
    }),

    defineField({
      name: "customPadding",
      type: "number",
      title: "Custom padding (px)",
      description: "Only used when padding is set to Custom.",
      hidden: ({ parent }) => parent?.paddingMode !== "custom",
      validation: (Rule) => Rule.min(0).max(200),
    }),

    defineField({
      name: "items",
      type: "array",
      title: "Links",
      of: [
        defineField({
          name: "item",
          type: "object",
          title: "Link item",
          fields: [
            defineField({
              name: "label",
              type: "string",
              title: "Label",
              description: "Override title shown in the grid. Defaults to page title.",
            }),
            defineField({
              name: "subline",
              type: "string",
              title: "Subline",
            }),
            defineField({
              name: "page",
              type: "reference",
              title: "Internal page",
              to: [{ type: "page" }],
            }),
            defineField({
              name: "externalUrl",
              type: "url",
              title: "External URL",
            }),
            defineField({
              name: "image",
              type: "image",
              title: "Custom image",
              options: { hotspot: true },
              fields: [
                defineField({
                  name: "alt",
                  type: "string",
                  title: "Alt",
                }),
              ],
            }),

            // NEW: text position per tile
            defineField({
              name: "textPosition",
              title: "Text position",
              type: "string",
              options: {
                list: [
                  {
                    title: "Below image (left aligned)",
                    value: "below-left",
                  },
                  {
                    title: "Right of image (top aligned)",
                    value: "top-right",
                  },
                  {
                    title: "Centered over image",
                    value: "center-over",
                  },
                ],
                layout: "radio",
              },
              initialValue: "below-left",
            }),
          ],
          validation: (Rule) =>
            Rule.custom((val) => {
              const hasPage = !!val?.page;
              const hasExternal = !!val?.externalUrl;
              if (!hasPage && !hasExternal) {
                return "Provide a page or an external URL";
              }
              return true;
            }),
        }),
      ],
      validation: (Rule) => Rule.min(1),
    }),
  ],
  preview: {
    select: {
      title: "title",
      count: "items.length",
    },
    prepare({ title, count }) {
      return {
        title: "Page Link Section",
        subtitle: `${title || "Untitled"} · ${count || 0} links`,
      };
    },
  },
});
