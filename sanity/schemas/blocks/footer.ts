// sanity/schemas/footer.ts
import { defineType, defineField } from "sanity";
import { LayoutTemplate } from "lucide-react";

export default defineType({
  name: "footer",
  title: "Footer",
  type: "document",
  icon: LayoutTemplate,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      description: "Main footer title shown on the left.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "links",
      title: "Links",
      type: "array",
      of: [
        defineField({
          name: "link",
          type: "object",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "href",
              title: "URL",
              type: "url",
              validation: (r) => r.required(),
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "href" },
          },
        }),
      ],
    }),
    defineField({
      name: "copyright",
      title: "Copyright line",
      type: "string",
      description: "e.g. © 2025 Carlos Ferreira. All rights reserved.",
    }),
    defineField({
      name: "images",
      title: "Right column images",
      type: "array",
      of: [
        defineField({
          name: "image",
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt text",
              type: "string",
            }),
          ],
        }),
      ],
      description: "These will loop vertically on the right.",
    }),
  ],
  preview: {
    select: {
      title: "title",
      linksCount: "links.length",
      imagesCount: "images.length",
    },
    prepare({ title, linksCount, imagesCount }) {
      return {
        title: title || "Footer",
        subtitle: `${linksCount || 0} links · ${imagesCount || 0} images`,
      };
    },
  },
});
