//components/ui/section-container.tsx
import { cn } from "@/lib/utils";
import { SectionPadding, ColorVariant } from "@/sanity.types";

interface SectionContainerProps {
  color?: ColorVariant | null;
  padding?: SectionPadding | null;
  children: React.ReactNode;
  className?: string;
}

export default function SectionContainer({
  color = "background",
  padding,
  children,
  className,
}: SectionContainerProps) {
  return (
    <div
      className={cn(
      )}
    >
      <div >{children}</div>
    </div>
  );
}
