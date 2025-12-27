// schemas/documents/project.ts
import { defineType, defineField } from "sanity";
import { orderRankField, orderRankOrdering } from "@sanity/orderable-document-list";

export default defineType({
  name: "project",
  type: "document",
  title: "Project",
  orderings: [orderRankOrdering],
  fields: [
    orderRankField({ type: "project" }),

    defineField({
      name: "title",
      type: "string",
      validation: Rule => Rule.required(),
    }),

    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title" },
      validation: Rule => Rule.required(),
    }),

    defineField({
      name: "year",
      type: "number",
      validation: Rule => Rule.required().min(1900).max(2100),
    }),

    defineField({
      name: "client",
      type: "string",
    }),

    // Theme uses color picker in Studio, but frontend only sees strings
    defineField({
      name: "theme",
      title: "Theme",
      type: "object",
      fields: [
        defineField({
          name: "bg",
          title: "Background color",
          type: "color",
        }),
        defineField({
          name: "text",
          title: "Text color",
          type: "color",
        }),
      ],
    }),

    defineField({
      name: "details",
      title: "Details",
      type: "array",
      of: [{ type: "project-detail" }],
      options: { sortable: true },
    }),

    defineField({
      name: "featuredImage",
      title: "Featured Image",
      type: "image",
      options: { hotspot: true },
      fields: [
        {
          name: "alt",
          type: "string",
          title: "Alt",
        },
      ],
      validation: Rule => Rule.required(),
    }),

    defineField({
      name: "blocks",
      type: "array",
      of: [
        { type: "hero-1" },
        { type: "hero-2" },
        { type: "section-header" },
        { type: "split-row" },
        { type: "grid-row" },
        { type: "carousel-1" },
        { type: "carousel-2" },
        { type: "timeline-row" },
        { type: "cta-1" },
        { type: "logo-cloud-1" },
        { type: "faqs" },
        { type: "form-newsletter" },
        { type: "all-posts" },
        { type: "single-image" },
      ],
    }),
  ],
  preview: {
    select: {
      title: "title",
      media: "featuredImage",
    },
    prepare({ title, media }) {
      return { title, media };
    },
  },
});
