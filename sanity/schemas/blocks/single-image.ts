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
      media: "image",
      alt: "image.alt",
    },
    prepare({ alt, media }) {
      return {
        title: "Single image",
        subtitle: alt || "No alt text",
        media,
      };
    },
  },
});
