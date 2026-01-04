// sanity/schemas/objects/image-text-grid.ts
import { defineType, defineField } from "sanity";
import { LayoutGrid } from "lucide-react";

export default defineType({
  name: "image-text-grid",
  title: "Image + Text Grid",
  type: "object",
  icon: LayoutGrid,
  fields: [
    defineField({
      name: "widthMode",
      title: "Section width",
      type: "string",
      initialValue: "medium",
      options: {
        layout: "radio",
        list: [
          { title: "Small", value: "small" },
          { title: "Medium", value: "medium" },
          { title: "Large (100svw)", value: "large" },
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "showScrollLine",
      title: "Show section scroll line",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "items",
      title: "Grid items",
      type: "array",
      of: [{ type: "image-text-grid-image" }, { type: "image-text-grid-text" }],
      validation: (r) => r.min(1).max(12),
    }),
  ],
  preview: {
    select: {
      widthMode: "widthMode",
      count: "items.length",
      showScrollLine: "showScrollLine",
    },
    prepare({ widthMode, count, showScrollLine }) {
      const line = showScrollLine ? "• line on" : "• line off";
      return {
        title: "Image + Text Grid",
        subtitle: `${widthMode || "medium"} • ${typeof count === "number" ? count : 0} item(s) ${line}`,
      };
    },
  },
});
