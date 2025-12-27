// components/header/bookmark-link.tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

type BookmarkLinkProps = {
  href?: string;
  side?: "left" | "right";
  className?: string;
};

export default function BookmarkLink({
  href = "/",
  side = "left",
  className,
}: BookmarkLinkProps) {
  return (
    <Link
      href={href}
      aria-label="Home"
      className={cn(
        "group fixed top-0 z-50", // flush with top of viewport
        side === "left" ? "left-6" : "right-6",
        "inline-flex items-start justify-center",
        "h-[92px] w-12", // clickable area bigger than the bookmark
        className
      )}
    >
      {/* Visual bookmark (does NOT move, only extends) */}
      <div className="relative flex h-full w-full items-start justify-center pointer-events-none">
        <div className="flex flex-col items-center">
          {/* Top extension block: only this height animates */}
          <span
            className="
              block w-4 bg-red-500
              h-[24px]
              transition-[height] duration-300 ease-out
              group-hover:h-[50px]  /* +20px on hover */
            "
          />
          {/* Main bookmark with inverted triangle cutout at bottom */}
          <span
            aria-hidden
            className="
              block w-4 h-[40px] bg-red-500
              [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]
            "
          />
        </div>
      </div>
    </Link>
  );
}
