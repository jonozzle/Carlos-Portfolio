import { defineType, defineField } from "sanity";
import { LayoutTemplate } from "lucide-react";

export default defineType({
  name: "half-width-double-project",
  title: "Half width double Project",
  type: "object",
  icon: LayoutTemplate,
  fields: [
    defineField({
      name: "title",
      title: "Label (optional)",
      type: "string",
    }),
    defineField({
      name: "projects",
      title: "Projects",
      type: "array",
      of: [
        {
          name: "projectWithLayout",
          title: "Project",
          type: "object",
          fields: [
            defineField({
              name: "project",
              title: "Project",
              type: "reference",
              to: [{ type: "project" }],
              validation: (r) => r.required(),
            }),
            defineField({
              name: "textPosition",
              title: "Text position",
              type: "string",
              options: {
                list: [
                  {
                    title: "Below image (left aligned)",
                    value: "below-left",
                  },
                  {
                    title: "Right of image (top aligned)",
                    value: "top-right",
                  },
                ],
                layout: "radio",
              },
              initialValue: "below-left",
            }),
          ],
        },
      ],
      validation: (r) => r.min(1).max(2),
    }),
  ],
  preview: {
    select: {
      label: "title",
      firstProjectTitle: "projects.0.project.title",
      secondProjectTitle: "projects.1.project.title",
    },
    prepare({ label, firstProjectTitle, secondProjectTitle }) {
      const hasSecond = !!secondProjectTitle;
      const subtitleBase =
        label || firstProjectTitle || secondProjectTitle || "Select at least one project";

      return {
        title: "Half width double Project",
        subtitle: hasSecond ? `${subtitleBase} (+1 more)` : subtitleBase,
      };
    },
  },
});
