import { defineType, defineField } from "sanity";
import { LayoutTemplate } from "lucide-react";

export default defineType({
  name: "half-width-single-project",
  title: "Half width single Project",
  type: "object",
  icon: LayoutTemplate,
  fields: [
    defineField({
      name: "title",
      title: "Label (optional)",
      type: "string",
    }),
    defineField({
      name: "project",
      title: "Project",
      type: "reference",
      to: [{ type: "project" }],
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: {
      label: "title",
      projectTitle: "project.title",
    },
    prepare({ label, projectTitle }) {
      return {
        title: "Half width single Project",
        subtitle: label || projectTitle || "Select a project",
      };
    },
  },
});
