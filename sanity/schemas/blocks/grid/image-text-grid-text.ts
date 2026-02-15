// sanity/schemas/objects/image-text-grid-text.ts
import { defineType, defineField } from "sanity";
import { Type as TypeIcon } from "lucide-react";

export default defineType({
  name: "image-text-grid-text",
  title: "Grid Text",
  type: "object",
  icon: TypeIcon,
  fields: [
    defineField({
      name: "usePresetPosition",
      title: "Use preset position (instead of grid coordinates)",
      type: "boolean",
      initialValue: false,
      description: "Off = Grid coordinates. On = Preset X/Y anchors.",
    }),
    defineField({
      name: "presetX",
      title: "Preset X",
      type: "string",
      options: {
        layout: "radio",
        list: [
          { title: "Left", value: "left" },
          { title: "Center", value: "center" },
          { title: "Right", value: "right" },
        ],
      },
      initialValue: "center",
      hidden: ({ parent }) => !parent?.usePresetPosition,
    }),
    defineField({
      name: "presetY",
      title: "Preset Y",
      type: "string",
      options: {
        layout: "radio",
        list: [
          { title: "Top", value: "top" },
          { title: "Center", value: "center" },
          { title: "Bottom", value: "bottom" },
        ],
      },
      initialValue: "center",
      hidden: ({ parent }) => !parent?.usePresetPosition,
    }),
    defineField({
      name: "presetWidth",
      title: "Preset width",
      type: "string",
      options: {
        layout: "radio",
        list: [
          { title: "33% (min width: 320px)", value: "w33" },
          { title: "50% (min width: 420px)", value: "w50" },
          { title: "66% (min width: 520px)", value: "w66" },
          { title: "75% (min width: 640px)", value: "w75" },
          { title: "100% (min width: 760px)", value: "w100" },
        ],
      },
      initialValue: "w50",
      hidden: ({ parent }) => !parent?.usePresetPosition,
    }),
    defineField({
      name: "rowStart",
      title: "Row start",
      type: "number",
      hidden: ({ parent }) => !!parent?.usePresetPosition,
      validation: (r) => r.min(1).max(12),
    }),
    defineField({
      name: "rowEnd",
      title: "Row end",
      type: "number",
      description: "Exclusive end line (CSS grid). Must be > row start.",
      hidden: ({ parent }) => !!parent?.usePresetPosition,
      validation: (r) => r.min(2).max(13),
    }),
    defineField({
      name: "colStart",
      title: "Column start",
      type: "number",
      hidden: ({ parent }) => !!parent?.usePresetPosition,
      validation: (r) => r.min(1).max(12),
    }),
    defineField({
      name: "colEnd",
      title: "Column end",
      type: "number",
      description: "Exclusive end line (CSS grid). Must be > col start.",
      hidden: ({ parent }) => !!parent?.usePresetPosition,
      validation: (r) => r.min(2).max(13),
    }),

    defineField({
      name: "dropCap",
      title: "Large first letter (drop cap)",
      type: "boolean",
      initialValue: false,
    }),

    defineField({
      name: "body",
      title: "Body (rich text)",
      type: "array",
      of: [{ type: "block" }],
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: {
      rowStart: "rowStart",
      rowEnd: "rowEnd",
      colStart: "colStart",
      colEnd: "colEnd",
      dropCap: "dropCap",
      usePresetPosition: "usePresetPosition",
      presetX: "presetX",
      presetY: "presetY",
      presetWidth: "presetWidth",
    },
    prepare({ rowStart, rowEnd, colStart, colEnd, dropCap, usePresetPosition, presetX, presetY, presetWidth }) {
      return {
        title: "Grid Text",
        subtitle: usePresetPosition
          ? `preset: ${presetX ?? "center"} / ${presetY ?? "center"} • ${presetWidth ?? "w50"}${dropCap ? " • drop cap" : ""}`
          : `r ${rowStart ?? "?"}–${rowEnd ?? "?"}, c ${colStart ?? "?"}–${colEnd ?? "?"}${dropCap ? " • drop cap" : ""}`,
      };
    },
  },
});
