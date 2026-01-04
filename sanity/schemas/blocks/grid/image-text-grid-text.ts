// sanity/schemas/objects/image-text-grid-text.ts
import { defineType, defineField } from "sanity";
import { Type as TypeIcon } from "lucide-react";

export default defineType({
  name: "image-text-grid-text",
  title: "Grid Text",
  type: "object",
  icon: TypeIcon,
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
      name: "dropCap",
      title: "Large first letter (drop cap)",
      type: "boolean",
      initialValue: false,
    }),

    defineField({
      name: "body",
      title: "Body (rich text)",
      type: "array",
      of: [{ type: "block" }],
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: {
      rowStart: "rowStart",
      rowEnd: "rowEnd",
      colStart: "colStart",
      colEnd: "colEnd",
      dropCap: "dropCap",
    },
    prepare({ rowStart, rowEnd, colStart, colEnd, dropCap }) {
      return {
        title: "Grid Text",
        subtitle: `r ${rowStart ?? "?"}–${rowEnd ?? "?"}, c ${colStart ?? "?"}–${colEnd ?? "?"}${dropCap ? " • drop cap" : ""
          }`,
      };
    },
  },
});
