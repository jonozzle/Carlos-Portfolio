// sanity/schemas/objects/image-text-grid-image.ts
import { defineType, defineField } from "sanity";
import { Image as ImageIcon } from "lucide-react";

export default defineType({
  name: "image-text-grid-image",
  title: "Grid Image",
  type: "object",
  icon: ImageIcon,
  fields: [
    defineField({
      name: "rowStart",
      title: "Row start",
      type: "number",
      validation: (r) => r.min(1).max(12),
    }),
    defineField({
      name: "rowEnd",
      title: "Row end",
      type: "number",
      description: "Exclusive end line (CSS grid). Must be > row start.",
      validation: (r) => r.min(2).max(13),
    }),
    defineField({
      name: "colStart",
      title: "Column start",
      type: "number",
      validation: (r) => r.min(1).max(12),
    }),
    defineField({
      name: "colEnd",
      title: "Column end",
      type: "number",
      description: "Exclusive end line (CSS grid). Must be > col start.",
      validation: (r) => r.min(2).max(13),
    }),

    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Alt text",
          type: "string",
        }),
      ],
      validation: (r) => r.required(),
    }),

    defineField({
      name: "withColorBlock",
      title: "Color block behind image",
      type: "boolean",
      initialValue: false,
    }),

    defineField({
      name: "caption",
      title: "Caption (rich text)",
      type: "array",
      of: [{ type: "block" }],
    }),
  ],
  preview: {
    select: {
      media: "image",
      rowStart: "rowStart",
      rowEnd: "rowEnd",
      colStart: "colStart",
      colEnd: "colEnd",
    },
    prepare({ media, rowStart, rowEnd, colStart, colEnd }) {
      return {
        title: "Grid Image",
        subtitle: `r ${rowStart ?? "?"}–${rowEnd ?? "?"}, c ${colStart ?? "?"}–${colEnd ?? "?"}`,
        media,
      };
    },
  },
});
