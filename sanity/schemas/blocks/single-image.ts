// sanity/schemas/blocks/single-image.ts
import { defineType, defineField } from "sanity";
import { Image as ImageIcon } from "lucide-react";

const hasCaption = (parent: any) => Array.isArray(parent?.caption) && parent.caption.length > 0;

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
          { title: "Small", value: "sm" },
          { title: "Medium", value: "md" },
          { title: "Large", value: "lg" },
          { title: "XL", value: "xl" },
        ],
      },
      initialValue: "md",
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

    defineField({
      name: "caption",
      title: "Photo caption",
      type: "array",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "captionPosition",
      title: "Caption position (desktop)",
      type: "string",
      options: {
        layout: "radio",
        list: [
          { title: "Top left", value: "topLeft" },
          { title: "Top right", value: "topRight" },
          { title: "Bottom left", value: "bottomLeft" },
          { title: "Bottom right", value: "bottomRight" },
        ],
      },
      initialValue: "bottomRight",
      hidden: ({ parent }) => !hasCaption(parent),
    }),
    defineField({
      name: "captionColor",
      title: "Caption text color",
      type: "color",
      options: { disableAlpha: true },
      initialValue: { hex: "#000000" },
      hidden: ({ parent }) => !hasCaption(parent),
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
