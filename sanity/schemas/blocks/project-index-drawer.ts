// src: sanity/schemas/project-index-drawer.ts
import { defineField, defineType } from "sanity";
import { Menu, BookA } from "lucide-react";

export default defineType({
  name: "projectIndexDrawer",
  title: "Project Index Drawer",
  type: "document",
  icon: Menu,


  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      initialValue: "Project Index",
      description: "Small label shown at the top of the drawer.",
    }),

    defineField({
      name: "showNumbers",
      title: "Show numbering",
      type: "boolean",
      initialValue: false,
      description: "Adds an index number to the left of each project title.",
    }),

    defineField({
      name: "showProjectDetails",
      title: "Show project details",
      type: "boolean",
      initialValue: true,
      description: "Shows the project year under the title, then the client under the year.",
    }),

    defineField({
      name: "heightDesktop",
      title: "Drawer height (desktop)",
      type: "string",
      description: "Overrides the drawer max height on desktop. Use svh (e.g., 48svh).",
    }),

    defineField({
      name: "heightMobile",
      title: "Drawer height (mobile)",
      type: "string",
      description: "Overrides the drawer max height on mobile. Use svh (e.g., 60svh).",
    }),

    defineField({
      name: "items",
      title: "Drawer Projects",
      type: "array",
      of: [
        defineField({
          name: "item",
          title: "Item",
          type: "object",
          fields: [
            defineField({
              name: "project",
              title: "Project",
              type: "reference",
              to: [{ type: "project" }],
              icon: BookA,
              validation: (r) => r.required(),
            }),

            // GRID placement (28×28)
            defineField({
              name: "col",
              title: "Grid column (1–28)",
              type: "number",
              initialValue: 14,
              validation: (r) => r.required().integer().min(1).max(28),
              description: "Column index in the 28×28 grid.",
            }),
            defineField({
              name: "row",
              title: "Grid row (1–28)",
              type: "number",
              initialValue: 14,
              validation: (r) => r.required().integer().min(1).max(28),
              description: "Row index in the 28×28 grid.",
            }),
          ],
          preview: {
            select: { title: "project.title", col: "col", row: "row" },
            prepare({ title, col, row }) {
              return {
                title: title || "Untitled",
                subtitle:
                  typeof col === "number" && typeof row === "number"
                    ? `Grid: c${col} r${row}`
                    : "Drawer item",
              };
            },
          },
        }),
      ],
      validation: (r) => r.min(1).max(200),
    }),
  ],

  preview: {
    select: { title: "title", items: "items" },
    prepare({ title, items }) {
      const count = Array.isArray(items) ? items.length : 0;
      return {
        title: "Project Index Drawer",
        subtitle: `${(title || "Project Index").trim() || "Project Index"} • ${count} item${count === 1 ? "" : "s"
          }`,
      };
    },
  },
});
