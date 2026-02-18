// src: sanity/schemas/ad-section.ts
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
      name: "desktop",
      title: "Desktop",
      type: "object",
      description: "Applies at tablet and up (>= md).",
      options: { collapsible: true, collapsed: true },
      initialValue: {
        orientation: "horizontal",
        parallaxEnabled: true,
        parallaxAmount: "md",
        sectionWidth: "medium",
      },
      fields: [
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
              { title: "Auto (image width)", value: "auto" },
            ],
            layout: "radio",
          },
          initialValue: "medium",
        }),
      ],
    }),

    defineField({
      name: "mobile",
      title: "Mobile",
      type: "object",
      description: "Applies below tablet (< md).",
      options: { collapsible: true, collapsed: true },
      initialValue: {
        orientation: "horizontal",
        parallaxEnabled: true,
        parallaxAmount: "md",
        height: "ratio-4-5",
      },
      fields: [
        defineField({
          name: "height",
          title: "Height",
          type: "string",
          options: {
            list: [
              { title: "Auto (image ratio)", value: "auto" },
              { title: "Square (1:1)", value: "ratio-1-1" },
              { title: "Portrait (4:5)", value: "ratio-4-5" },
              { title: "Portrait (3:4)", value: "ratio-3-4" },
              { title: "Landscape (16:9)", value: "ratio-16-9" },
              { title: "Height = 100vh", value: "vh-100" },
              { title: "Height = 50vh", value: "vh-50" },
            ],
          },
          initialValue: "ratio-4-5",
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
      ],
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
      dOrientation: "desktop.orientation",
      dWidth: "desktop.sectionWidth",
      dParallaxEnabled: "desktop.parallaxEnabled",
      dParallaxAmount: "desktop.parallaxAmount",
      mHeight: "mobile.height",
      mOrientation: "mobile.orientation",
      mParallaxEnabled: "mobile.parallaxEnabled",
      mParallaxAmount: "mobile.parallaxAmount",
    },
    prepare({
      title,
      count,
      dOrientation,
      dWidth,
      dParallaxEnabled,
      dParallaxAmount,
      mHeight,
      mOrientation,
      mParallaxEnabled,
      mParallaxAmount,
    }) {
      const oLabel = (o: any) => (o === "vertical" ? "Vertical" : "Horizontal");
      const widthLabel =
        dWidth === "narrow"
          ? "Narrow"
          : dWidth === "wide"
            ? "Wide"
            : dWidth === "full"
              ? "Full"
              : dWidth === "auto"
                ? "Auto"
              : "Medium";

      const dParLabel = dParallaxEnabled === false ? "parallax off" : `parallax ${dParallaxAmount || "md"}`;
      const mParLabel = mParallaxEnabled === false ? "parallax off" : `parallax ${mParallaxAmount || "md"}`;

      const mHeightLabel =
        mHeight === "auto"
          ? "Auto"
          : mHeight === "vh-100"
          ? "100vh"
          : mHeight === "vh-50"
            ? "50vh"
            : mHeight === "ratio-1-1"
              ? "1:1"
              : mHeight === "ratio-3-4"
                ? "3:4"
                : mHeight === "ratio-16-9"
                  ? "16:9"
                  : "4:5";

      return {
        title: "Ad Section",
        subtitle: `${title || "Untitled"} · ${count || 0} images · Desktop: ${oLabel(dOrientation)} · ${widthLabel} · ${dParLabel} · Mobile: ${oLabel(
          mOrientation
        )} · ${mHeightLabel} · ${mParLabel}`,
      };
    },
  },
});
