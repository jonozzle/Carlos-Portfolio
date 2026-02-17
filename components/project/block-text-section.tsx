"use client";

import React, { useMemo } from "react";
import { PortableText } from "@portabletext/react";
import clsx from "clsx";

import PageStartScrollLine from "@/components/ui/page-start-scroll-line";

type BlockText = {
  body?: any[] | null;
  dropCap?: boolean | null;
  showPageStartScrollLine?: boolean | null;
  pageStartScrollLinePosition?: "top" | "bottom" | null;
};

type StyleCfg = {
  tag: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote";
  className: string;
  lh: number;
  capTop: string;
  capTrimEm: number;
};

function cfgForStyle(styleKey: string): StyleCfg {
  switch (styleKey) {
    case "h1":
      return { tag: "h1", className: "text-4xl md:text-6xl leading-[1.05]", lh: 1.05, capTop: "0.04em", capTrimEm: 0.22 };
    case "h2":
      return { tag: "h2", className: "text-3xl md:text-5xl leading-[1.08]", lh: 1.08, capTop: "0.045em", capTrimEm: 0.23 };
    case "h3":
      return { tag: "h3", className: "text-2xl md:text-4xl leading-[1.12]", lh: 1.12, capTop: "0.05em", capTrimEm: 0.24 };
    case "h4":
      return { tag: "h4", className: "text-xl md:text-3xl leading-[1.18]", lh: 1.18, capTop: "0.055em", capTrimEm: 0.26 };
    case "h5":
      return { tag: "h5", className: "text-lg md:text-2xl leading-[1.22]", lh: 1.22, capTop: "0.06em", capTrimEm: 0.27 };
    case "h6":
      return { tag: "h6", className: "text-base md:text-xl leading-[1.26]", lh: 1.26, capTop: "0.065em", capTrimEm: 0.28 };
    case "blockquote":
      return { tag: "blockquote", className: "text-lg md:text-xl italic leading-[1.4]", lh: 1.4, capTop: "0.07em", capTrimEm: 0.3 };
    case "normal":
    default:
      return { tag: "p", className: "text-base md:text-lg leading-[1.4]", lh: 1.4, capTop: "0.07em", capTrimEm: 0.3 };
  }
}

function isLikelyExternal(href: string) {
  const h = (href ?? "").trim();
  return h.startsWith("http://") || h.startsWith("https://");
}

export default function BlockTextSection({
  body,
  dropCap,
  showPageStartScrollLine,
  pageStartScrollLinePosition,
}: BlockText) {
  const safeBody = Array.isArray(body) ? body : [];
  if (!safeBody.length) return null;

  const firstBlockKey = useMemo(() => {
    if (!dropCap) return null;
    const first = safeBody.find((b) => b && b._type === "block" && typeof b._key === "string");
    return first?._key ?? null;
  }, [dropCap, safeBody]);

  const components = useMemo(() => {
    return {
      marks: {
        strong: (p: any) => <strong className="font-bold">{p.children}</strong>,
        em: (p: any) => <em className="italic">{p.children}</em>,
        link: (p: any) => {
          const href = typeof p?.value?.href === "string" ? p.value.href.trim() : "";
          if (!href) return p.children;

          const external = isLikelyExternal(href);
          return (
            <a
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="underline underline-offset-2"
            >
              {p.children}
            </a>
          );
        },
      },
      block: (p: any) => {
        const styleKey = p?.value?.style || "normal";
        const isFirst = !!dropCap && !!firstBlockKey && p?.value?._key === firstBlockKey;
        const cfg = cfgForStyle(styleKey);
        const Tag = cfg.tag as any;

        const className = clsx("it-pt-block font-serif font-normal tracking-tight", cfg.className, isFirst && "it-dropcap-target");

        const styleVars = isFirst
          ? ({
              ["--lh" as any]: String(cfg.lh),
              ["--cap-top" as any]: cfg.capTop,
              ["--cap-trim" as any]: String(cfg.capTrimEm),
              ["--cap-lines" as any]: "2",
            } as React.CSSProperties)
          : undefined;

        return (
          <Tag className={className} style={styleVars}>
            {p.children}
          </Tag>
        );
      },
    };
  }, [dropCap, firstBlockKey]);

  const showLine = !!showPageStartScrollLine;
  const linePosition = pageStartScrollLinePosition === "top" ? "top" : "bottom";

  return (
    <div className="w-full">
      {showLine && linePosition === "top" ? (
        <div className="mb-8">
          <PageStartScrollLine enabled />
        </div>
      ) : null}

      <div className="it-pt w-full">
        <PortableText value={safeBody} components={components as any} />
      </div>

      {showLine && linePosition === "bottom" ? (
        <div className="mt-8">
          <PageStartScrollLine enabled />
        </div>
      ) : null}
    </div>
  );
}
