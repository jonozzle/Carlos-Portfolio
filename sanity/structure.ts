// desk/structure.ts
import { orderableDocumentListDeskItem } from "@sanity/orderable-document-list";
import { Files, BookA, Menu, Settings, LayoutTemplate } from "lucide-react";

export const structure = (S: any, context: any) =>
  S.list()
    .title("Content")
    .items([
      orderableDocumentListDeskItem({
        type: "page",
        title: "Pages",
        icon: Files,
        S,
        context,
      }),
      orderableDocumentListDeskItem({
        type: "project",
        title: "Projects",
        icon: BookA,
        S,
        context,
      }),

      S.divider({ title: "Global" }),

      S.listItem()
        .title("Navigation")
        .icon(Menu)
        .child(
          S.editor()
            .id("navigation")
            .schemaType("navigation")
            .documentId("navigation"),
        ),

      S.listItem()
        .title("Footer")
        .icon(LayoutTemplate)
        .child(
          S.editor()
            .id("footer")
            .schemaType("footer")
            .documentId("footer"),
        ),

      S.listItem()
        .title("Settings")
        .icon(Settings)
        .child(
          S.editor()
            .id("settings")
            .schemaType("settings")
            .documentId("settings"),
        ),
    ]);
