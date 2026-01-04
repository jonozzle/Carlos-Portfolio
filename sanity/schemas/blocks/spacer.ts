// sanity/schemas/blocks/spacer.ts
import { defineType, defineField } from "sanity";

export default defineType({
  name: "spacer",
  title: "Spacer",
  type: "object",
  fields: [
    defineField({
      name: "size",
      title: "Size",
      type: "string",
      options: {
        layout: "radio",
        list: [
          { title: "Small", value: "small" },
          { title: "Medium", value: "medium" },
          { title: "Large", value: "large" },
        ],
      },
      initialValue: "medium",
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: {
      size: "size",
    },
    prepare({ size }) {
      return {
        title: "Spacer",
        subtitle: size ? `Size: ${size}` : "No size",
      };
    },
  },
});
