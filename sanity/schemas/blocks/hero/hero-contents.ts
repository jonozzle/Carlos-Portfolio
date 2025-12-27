// sanity/schemas/objects/hero-contents.ts
import { defineType, defineField } from "sanity";
import { LayoutTemplate, Image as ImageIcon } from "lucide-react";

export default defineType({
  name: "hero-contents",
  title: "Hero Contents",
  type: "object",
  icon: LayoutTemplate,
  fields: [
    defineField({
      name: "title",
      type: "string",
      description: "Optional heading",
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

    defineField({
      name: "items",
      title: "Featured Projects",
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
              name: "overlayImage",
              title: "Overlay Image",
              type: "image",
              options: { hotspot: true },
              icon: ImageIcon,
              description:
                "Optional transparent PNG layered on top of the text in the Feature Left layout.",
            }),
            defineField({
              name: "layout",
              title: "Layout / Animation",
              type: "string",
              options: {
                list: [
                  {
                    title: "Feature Left (corner clip)",
                    value: "feature-left",
                  },
                  {
                    title: "Feature Right (reversed clip)",
                    value: "feature-right",
                  },
                  {
                    title: "Center Overlay (fade / scale)",
                    value: "center-overlay",
                  },
                ],
                layout: "radio",
              },
              initialValue: "feature-left",
              description:
                "Controls both layout and in/out animation for this project when active.",
            }),
            defineField({
              name: "x",
              title: "X position (%)",
              type: "number",
              validation: (r) => r.min(0).max(100),
              description:
                "0–100. Horizontal position of the link (used only in Custom placement).",
            }),
            defineField({
              name: "y",
              title: "Y position (%)",
              type: "number",
              validation: (r) => r.min(0).max(100),
              description:
                "0–100. Vertical position of the link (used only in Custom placement).",
            }),
          ],
          preview: {
            select: { title: "project.title", media: "image" },
            prepare({ title, media }) {
              return {
                title: title || "Untitled",
                media,
                subtitle: "Hero item",
              };
            },
          },
        }),
      ],
      validation: (r) => r.min(1).max(100),
    }),
  ],
  preview: {
    select: { title: "title" },
    prepare({ title }) {
      return {
        title: "Hero Contents",
        subtitle: title || "Selected projects",
      };
    },
  },
});
