// ImageTextGridTextBlock
// components/blocks/image-text-grid-text-block.tsx
"use client";

import React, { useMemo } from "react";
import { PortableText } from "@portabletext/react";
import clsx from "clsx";

type Props = {
  gridColumn: string;
  gridRow: string;
  body?: any[] | null;
  dropCap?: boolean | null;
};

type StyleCfg = {
  tag: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote";
  className: string; // includes explicit leading
  lh: number; // must match the leading above
  capTop: string; // visual nudge down
  capTrimEm: number; // trims the float’s reserved height (fixes “bottom margin” look)
};

function cfgForStyle(style: string): StyleCfg {
  // Key idea:
  // - cap font-size is 2 lines: calc(2 * lh * 1em)
  // - capTrimEm subtracts from the float box height to remove em-box “dead space”
  // Tune capTrimEm until the second line sits snugly without a big gap.
  switch (style) {
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
      return { tag: "blockquote", className: "text-lg md:text-xl italic leading-[1.4]", lh: 1.4, capTop: "0.07em", capTrimEm: 0.30 };
    case "normal":
    default:
      return { tag: "p", className: "text-base md:text-lg leading-[1.4]", lh: 1.4, capTop: "0.07em", capTrimEm: 0.30 };
  }
}

export default function ImageTextGridTextBlock({ gridColumn, gridRow, body, dropCap }: Props) {
  const firstBlockKey = useMemo(() => {
    if (!dropCap) return null;
    if (!Array.isArray(body)) return null;
    const first = body.find((b) => b && b._type === "block" && typeof b._key === "string");
    return first?._key ?? null;
  }, [dropCap, body]);

  const components = useMemo(() => {
    return {
      // Make everything regular by default; bold only when editor applies strong.
      marks: {
        strong: (p: any) => <strong className="font-bold">{p.children}</strong>,
      },
      block: (p: any) => {
        const style = p?.value?.style || "normal";
        const isFirst = !!dropCap && !!firstBlockKey && p?.value?._key === firstBlockKey;
        const cfg = cfgForStyle(style);

        const Tag = cfg.tag as any;

        const className = clsx(
          "it-pt-block font-serif font-normal tracking-tight",
          cfg.className,
          isFirst && "it-dropcap-target"
        );

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

  return (
    <div className="relative z-10" style={{ gridColumn, gridRow }}>
      <div className="h-full w-full overflow-hidden flex items-start">
        <div className="w-full max-w-full it-pt">
          {body?.length ? (
            <PortableText value={body} components={components as any} />
          ) : (
            <div className="text-xs opacity-60">No text</div>
          )}
        </div>
      </div>

      <style jsx global>{`
        /* Kill browser default margins on headings/paragraphs so nothing “mysterious” shifts */
        .it-pt .it-pt-block {
          margin: 0;
          padding: 0;
          font-weight: 400;
        }

        /* Your spacing between blocks (instead of default margins) */
        .it-pt .it-pt-block + .it-pt-block {
          margin-top: 0.9em;
        }

        /*
          Dropcap mechanics:
          - font-size = 2 lines: cap-lines * lh * 1em
          - line-height on the cap itself kept tight so it doesn't add extra vertical
          - NEGATIVE margin-bottom trims the float reservation (this is the “bottom margin” fix)
        */
        .it-dropcap-target::first-letter {
          float: left;
          display: block;
          position: relative;

          font-size: calc(var(--cap-lines, 2) * var(--lh, 1.4) * 1em);

          /* keep the glyph box tight (don’t inflate the float height) */
          line-height: 0.85;

          top: var(--cap-top, 0.07em);
          margin-right: 0.55rem;

          /* THIS removes the “cap has bottom margin” look */
          margin-bottom: calc(-1 * var(--cap-trim, 0.3) * 1em);

          font-weight: 600;
          letter-spacing: -0.02em;
        }

        /*
          Optional: if you ever can rely on Safari, this is the “correct” solution.
          It aligns to line boxes without float hacks. Chrome still doesn’t fully support it.
        */
        @supports (-webkit-initial-letter: 2) or (initial-letter: 2) {
          .it-dropcap-target::first-letter {
            float: none;
            display: inline;
            margin: 0 0.55rem 0 0;
            line-height: normal;
            top: 0;

            -webkit-initial-letter: 2;
            initial-letter: 2;

            /* keep your weight/spacing */
            font-weight: 600;
            letter-spacing: -0.02em;
          }
        }
      `}</style>
    </div>
  );
}
