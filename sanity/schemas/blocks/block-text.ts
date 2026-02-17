import { defineField, defineType } from "sanity";
import { Type as TypeIcon } from "lucide-react";

export default defineType({
  name: "block-text",
  title: "Block text",
  type: "object",
  icon: TypeIcon,
  fields: [
    defineField({
      name: "body",
      title: "Body (rich text)",
      type: "array",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "dropCap",
      title: "Large first letter (drop cap)",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "showPageStartScrollLine",
      title: "Show page-start scroll line",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "pageStartScrollLinePosition",
      title: "Scroll line position",
      type: "string",
      options: {
        layout: "radio",
        list: [
          { title: "Top of block", value: "top" },
          { title: "Below block", value: "bottom" },
        ],
      },
      initialValue: "bottom",
      hidden: ({ parent }) => !parent?.showPageStartScrollLine,
    }),
  ],
  preview: {
    select: {
      body: "body",
      dropCap: "dropCap",
      showLine: "showPageStartScrollLine",
      linePosition: "pageStartScrollLinePosition",
    },
    prepare({ body, dropCap, showLine, linePosition }) {
      const count = Array.isArray(body) ? body.length : 0;
      const parts = [
        `${count} block${count === 1 ? "" : "s"}`,
        dropCap ? "drop cap" : null,
        showLine ? `line ${linePosition === "top" ? "top" : "bottom"}` : null,
      ].filter(Boolean);

      return {
        title: "Block text",
        subtitle: parts.join(" | "),
      };
    },
  },
});
