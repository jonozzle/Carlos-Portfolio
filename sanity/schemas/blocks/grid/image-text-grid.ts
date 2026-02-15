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
      name: "paddingMode",
      title: "Padding",
      type: "string",
      options: {
        layout: "radio",
        list: [
          { title: "None", value: "none" },
          { title: "Small", value: "sm" },
          { title: "Medium", value: "md" },
          { title: "Large", value: "lg" },
          { title: "XL", value: "xl" },
        ],
      },
      initialValue: "md",
    }),
    defineField({
      name: "paddingSideOverrides",
      title: "Padding side overrides",
      description: "Optional. Remove padding from selected sides (choose none, one, or multiple).",
      type: "array",
      of: [{ type: "string" }],
      options: {
        layout: "grid",
        list: [
          { title: "Top", value: "top" },
          { title: "Right", value: "right" },
          { title: "Bottom", value: "bottom" },
          { title: "Left", value: "left" },
        ],
      },
      validation: (r) => r.unique(),
      initialValue: [],
    }),
    defineField({
      name: "widthMode",
      title: "Section width",
      type: "string",
      initialValue: "medium",
      description: "Each option defines both a viewport width and a pixel min width to avoid collapsing on small windows.",
      options: {
        layout: "radio",
        list: [
          { title: "XXS (30vw, min size: 320px)", value: "xxs" },
          { title: "XS (40vw, min size: 420px)", value: "xs" },
          { title: "SM (50vw, min size: 520px)", value: "half" },
          { title: "MD (60vw, min size: 640px)", value: "small" },
          { title: "LG (80vw, min size: 820px)", value: "medium" },
          { title: "XL (100vw, min size: 960px)", value: "large" },
          { title: "2XL (120vw, min size: 1080px)", value: "xl" },
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
