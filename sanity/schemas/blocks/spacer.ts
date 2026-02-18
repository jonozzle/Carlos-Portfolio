// sanity/schemas/blocks/spacer.ts
import { defineType, defineField } from "sanity";

export default defineType({
  name: "spacer",
  title: "Spacer",
  type: "object",
  fieldsets: [
    {
      name: "desktop",
      title: "Desktop",
      options: { collapsible: true, collapsed: false },
    },
    {
      name: "mobile",
      title: "Mobile",
      options: { collapsible: true, collapsed: true },
    },
  ],
  fields: [
    defineField({
      name: "desktopSize",
      title: "Size",
      type: "string",
      fieldset: "desktop",
      options: {
        layout: "dropdown",
        list: [
          { title: "None (0vw, min w 0px)", value: "none" },
          { title: "XS (8vw, min w 32px)", value: "xs" },
          { title: "SM (12vw, min w 48px)", value: "sm" },
          { title: "MD (18vw, min w 80px)", value: "md" },
          { title: "LG (24vw, min w 120px)", value: "lg" },
          { title: "XL (32vw, min w 160px)", value: "xl" },
        ],
      },
      initialValue: "md",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "mobileSize",
      title: "Size",
      type: "string",
      fieldset: "mobile",
      options: {
        layout: "dropdown",
        list: [
          { title: "None (0vh, min h 0px)", value: "none" },
          { title: "XS (6vh, min h 24px)", value: "xs" },
          { title: "SM (10vh, min h 40px)", value: "sm" },
          { title: "MD (16vh, min h 64px)", value: "md" },
          { title: "LG (24vh, min h 96px)", value: "lg" },
          { title: "XL (32vh, min h 128px)", value: "xl" },
        ],
      },
      initialValue: "none",
      validation: (r) => r.required(),
    }),
    // Legacy field kept hidden so existing docs can migrate without data loss.
    defineField({
      name: "size",
      title: "Legacy size",
      type: "string",
      hidden: true,
    }),
  ],
  preview: {
    select: {
      desktopSize: "desktopSize",
      mobileSize: "mobileSize",
      legacySize: "size",
    },
    prepare({ desktopSize, mobileSize, legacySize }) {
      const desktop = desktopSize ?? (legacySize === "small" ? "sm" : legacySize === "large" ? "lg" : "md");
      const mobile = mobileSize ?? "none";
      return {
        title: "Spacer",
        subtitle: `Desktop: ${desktop} • Mobile: ${mobile}`,
      };
    },
  },
});
