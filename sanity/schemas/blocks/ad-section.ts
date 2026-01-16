// sanity/schemas/ad-section.ts
import { defineType, defineField } from "sanity";

export default defineType({
  name: "ad-section",
  title: "Ad Section",
  type: "object",

  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
    }),

    defineField({
      name: "images",
      title: "Images",
      type: "array",
      of: [
        defineField({
          name: "adImage",
          title: "Ad Image",
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt text",
              type: "string",
            }),
          ],
        }),
      ],
      validation: (r) => r.min(1).max(12),
    }),

    defineField({
      name: "orientation",
      title: "Scroll orientation",
      type: "string",
      options: {
        list: [
          { title: "Horizontal", value: "horizontal" },
          { title: "Vertical", value: "vertical" },
        ],
        layout: "radio",
      },
      initialValue: "horizontal",
    }),

    defineField({
      name: "parallaxEnabled",
      title: "Enable parallax",
      type: "boolean",
      description: "Toggles the scroll-based parallax motion.",
      initialValue: true,
    }),

    defineField({
      name: "parallaxAmount",
      title: "Parallax amount",
      type: "string",
      options: {
        list: [
          { title: "Small", value: "sm" },
          { title: "Medium", value: "md" },
          { title: "Large", value: "lg" },
        ],
        layout: "radio",
      },
      initialValue: "md",
      hidden: ({ parent }) => parent?.parallaxEnabled === false,
    }),

    defineField({
      name: "sectionWidth",
      title: "Section width",
      type: "string",
      options: {
        list: [
          { title: "Narrow (≈35vw)", value: "narrow" },
          { title: "Medium (≈50vw)", value: "medium" },
          { title: "Wide (≈65vw)", value: "wide" },
          { title: "Full (100vw)", value: "full" },
        ],
        layout: "radio",
      },
      initialValue: "medium",
    }),

    defineField({
      name: "padded",
      title: "Add padding",
      type: "boolean",
      initialValue: false,
    }),

    defineField({
      name: "padding",
      title: "Padding amount (px)",
      type: "number",
      description: "Only applies when padding is enabled. Default 24px.",
      validation: (Rule) => Rule.min(0).max(200),
    }),

    defineField({
      name: "horizontalAlign",
      title: "Horizontal alignment",
      type: "string",
      options: {
        list: [
          { title: "Left", value: "left" },
          { title: "Center", value: "center" },
          { title: "Right", value: "right" },
        ],
        layout: "radio",
      },
      initialValue: "left",
    }),

    defineField({
      name: "verticalAlign",
      title: "Vertical alignment",
      type: "string",
      options: {
        list: [
          { title: "Top", value: "top" },
          { title: "Center", value: "center" },
          { title: "Bottom", value: "bottom" },
        ],
        layout: "radio",
      },
      initialValue: "center",
    }),

    defineField({
      name: "theme",
      title: "Theme",
      type: "object",
      fields: [
        defineField({
          name: "bg",
          title: "Background color",
          type: "string",
        }),
        defineField({
          name: "text",
          title: "Text color",
          type: "string",
        }),
      ],
    }),
  ],

  preview: {
    select: {
      title: "title",
      count: "images.length",
      orientation: "orientation",
      padded: "padded",
      sectionWidth: "sectionWidth",
      parallaxEnabled: "parallaxEnabled",
      parallaxAmount: "parallaxAmount",
    },
    prepare({
      title,
      count,
      orientation,
      padded,
      sectionWidth,
      parallaxEnabled,
      parallaxAmount,
    }) {
      const label = orientation === "vertical" ? "Vertical" : "Horizontal";
      const widthLabel =
        sectionWidth === "narrow"
          ? "Narrow"
          : sectionWidth === "wide"
            ? "Wide"
            : sectionWidth === "full"
              ? "Full"
              : "Medium";

      const padLabel = padded ? "with padding" : "no padding";
      const parallaxLabel =
        parallaxEnabled === false ? "parallax off" : `parallax ${parallaxAmount || "md"}`;

      return {
        title: "Ad Section",
        subtitle: `${title || "Untitled"} · ${count || 0} images · ${label} · ${widthLabel} · ${padLabel} · ${parallaxLabel}`,
      };
    },
  },
});
