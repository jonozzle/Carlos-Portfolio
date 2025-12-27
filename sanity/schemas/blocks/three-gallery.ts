import { defineType, defineField } from "sanity";
import { LayoutTemplate } from "lucide-react";

export default defineType({
  name: "three-gallery",
  title: "Three Gallery",
  type: "object",
  icon: LayoutTemplate,
  fields: [
    defineField({ name: "title", type: "string" }),
    defineField({
      name: "projects",
      title: "Projects (max 3)",
      type: "array",
      of: [{ type: "reference", to: [{ type: "project" }] }],
      validation: r => r.min(1).max(3),
    }),
    defineField({
      name: "layout",
      title: "Layout",
      type: "string",
      initialValue: "A",
      options: {
        list: [
          { title: "Layout A", value: "A" },
          { title: "Layout B", value: "B" },
        ],
        layout: "radio",
      },
    }),
  ],
  preview: {
    select: { title: "title", count: "projects.length" },
    prepare({ title, count }) {
      return { title: "Three Gallery", subtitle: `${title || "Home block"} · ${count || 0} projects` };
    },
  },
});
