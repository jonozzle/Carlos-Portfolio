// ProjectBlock schema
// sanity/schemas/objects/project-block.ts
import { defineType, defineField } from "sanity";
import { LayoutTemplate } from "lucide-react";

export default defineType({
    name: "project-block",
    title: "Project Block",
    type: "object",
    icon: LayoutTemplate,
    fields: [
        defineField({
            name: "title",
            title: "Label (optional)",
            type: "string",
        }),
        defineField({
            name: "width",
            title: "Width (CSS value)",
            type: "string",
            description: 'e.g. "50vw", "75vw", "100vw". Defaults to "50vw" if empty.',
        }),
        defineField({
            name: "projects",
            title: "Projects",
            type: "array",
            of: [
                {
                    name: "projectWithLayout",
                    title: "Project with layout",
                    type: "object",
                    fieldsets: [
                        {
                            name: "mobile",
                            title: "Mobile",
                            options: { collapsible: true, collapsed: true },
                        },
                        {
                            name: "desktopGrid",
                            title: "Desktop grid",
                            options: { collapsible: true, collapsed: false },
                        },
                    ],
                    fields: [
                        defineField({
                            name: "project",
                            title: "Project",
                            type: "reference",
                            to: [{ type: "project" }],
                            validation: (r) => r.required(),
                        }),

                        // MOBILE LAYOUT
                        defineField({
                            name: "mobileLayout",
                            title: "Mobile layout",
                            type: "string",
                            fieldset: "mobile",
                            description:
                                "Applies below md. Controls where the project text sits relative to the image.",
                            initialValue: "below-left",
                            options: {
                                list: [
                                    { title: "Below left", value: "below-left" },
                                    { title: "Below right", value: "below-right" },
                                    { title: "Left", value: "left" },
                                    { title: "Right", value: "right" },
                                ],
                                layout: "radio",
                                direction: "vertical",
                            },
                        }),

                        // IMAGE GRID CONTROL (DESKTOP)
                        defineField({
                            name: "imageRowStart",
                            title: "Image row start",
                            type: "number",
                            fieldset: "desktopGrid",
                            description: "Row line where the image starts (1–12).",
                            validation: (r) => r.min(1).max(12),
                        }),
                        defineField({
                            name: "imageRowEnd",
                            title: "Image row end",
                            type: "number",
                            fieldset: "desktopGrid",
                            description:
                                "Exclusive end row (CSS grid style, e.g. 5 means rows 2–4 for start=2).",
                            validation: (r) => r.min(2).max(13),
                        }),
                        defineField({
                            name: "imageColStart",
                            title: "Image column start",
                            type: "number",
                            fieldset: "desktopGrid",
                            description: "Column line where the image starts (1–12).",
                            validation: (r) => r.min(1).max(12),
                        }),
                        defineField({
                            name: "imageColEnd",
                            title: "Image column end",
                            type: "number",
                            fieldset: "desktopGrid",
                            description:
                                "Exclusive end column (CSS grid style, e.g. 8 means columns 2–7 for start=2).",
                            validation: (r) => r.min(2).max(13),
                        }),

                        // INFO GRID CONTROL (DESKTOP)
                        defineField({
                            name: "infoRowStart",
                            title: "Info row start",
                            type: "number",
                            fieldset: "desktopGrid",
                            description: "Row line where the info block starts (1–12).",
                            validation: (r) => r.min(1).max(12),
                        }),
                        defineField({
                            name: "infoRowEnd",
                            title: "Info row end",
                            type: "number",
                            fieldset: "desktopGrid",
                            description:
                                "Exclusive end row (CSS grid style, e.g. 6 means rows 5–5 for start=5).",
                            validation: (r) => r.min(2).max(13),
                        }),
                        defineField({
                            name: "infoColStart",
                            title: "Info column start",
                            type: "number",
                            fieldset: "desktopGrid",
                            description: "Column line where the info block starts (1–12).",
                            validation: (r) => r.min(1).max(12),
                        }),
                        defineField({
                            name: "infoColEnd",
                            title: "Info column end",
                            type: "number",
                            fieldset: "desktopGrid",
                            description:
                                "Exclusive end column (CSS grid style, e.g. 10 means columns 2–9 for start=2).",
                            validation: (r) => r.min(2).max(13),
                        }),
                    ],
                },
            ],
            validation: (r) => r.min(1).max(4),
        }),
    ],
    preview: {
        select: {
            label: "title",
            firstProjectTitle: "projects.0.project.title",
            secondProjectTitle: "projects.1.project.title",
            thirdProjectTitle: "projects.2.project.title",
            fourthProjectTitle: "projects.3.project.title",
        },
        prepare({ label, firstProjectTitle, secondProjectTitle, thirdProjectTitle, fourthProjectTitle }) {
            const titles = [firstProjectTitle, secondProjectTitle, thirdProjectTitle, fourthProjectTitle].filter(Boolean);

            const subtitleBase = label || titles[0] || "Select at least one project";

            return {
                title: "Project Block",
                subtitle: titles.length > 1 ? `${subtitleBase} (+${titles.length - 1} more)` : subtitleBase,
            };
        },
    },
});
