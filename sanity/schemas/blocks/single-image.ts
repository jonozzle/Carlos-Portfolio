// sanity/schemas/blocks/single-image.ts
import { defineType, defineField } from "sanity";
import { Image as ImageIcon } from "lucide-react";

export default defineType({
  name: "single-image",
  title: "Single image",
  type: "object",
  icon: ImageIcon,
  fields: [
    defineField({
      name: "title",
      title: "Label / caption (optional)",
      type: "string",
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
          description: "Used for accessibility and SEO.",
        }),
      ],
      validation: (r) => r.required(),
    }),
    defineField({
      name: "paddingMode",
      title: "Padding",
      type: "string",
      options: {
        layout: "radio",
        list: [
          { title: "None", value: "none" },
          { title: "Default", value: "default" },
          { title: "Custom", value: "custom" },
        ],
      },
      initialValue: "default",
    }),
    defineField({
      name: "customPadding",
      title: "Custom padding (px)",
      type: "number",
      hidden: ({ parent }) => parent?.paddingMode !== "custom",
    }),
    defineField({
      name: "widthMode",
      title: "Width",
      type: "string",
      options: {
        layout: "radio",
        list: [
          { title: "Auto (image decides)", value: "auto" },
          { title: "Small (35vw)", value: "small" },
          { title: "Medium (50vw)", value: "medium" },
          { title: "Large (65vw)", value: "large" },
        ],
      },
      initialValue: "auto",
    }),
  ],
  preview: {
    select: {
      label: "title",
      media: "image",
    },
    prepare({ label, media }) {
      return {
        title: "Single image",
        subtitle: label || "No label",
        media,
      };
    },
  },
});
