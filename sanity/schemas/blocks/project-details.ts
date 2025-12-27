import { defineType, defineField } from "sanity";

export default defineType({
  name: "project-detail",
  title: "Project Detail",
  type: "object",
  fields: [
    defineField({
      name: "left",
      title: "Left",
      type: "string",
      validation: R => R.required(),
    }),
    defineField({
      name: "right",
      title: "Right",
      type: "string",
      validation: R => R.required(),
    }),
  ],
  preview: {
    select: { left: "left", right: "right" },
    prepare({ left, right }) {
      return { title: left || "Detail", subtitle: right || "" };
    },
  },
});
