"use client";

type Detail = { left?: string | null; right?: string | null };
export default function ProjectDetails({ details }: { details?: Detail[] | null }) {
    if (!details?.length) return null;

    /**
     * Layout rules:
     * - Two main columns that auto-extend (grid-cols-1 -> md:grid-cols-2).
     * - Each “row” is a two-column mini-grid: left and right fields.
     */
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 gap-x-24">
            {details.map((d, i) => (
                <div key={i} className="grid grid-cols-2 gap-1">
                    <div className="text-sm md:text-sm leading-tight">{d?.left}</div>
                    <div className="text-sm md:text-sm leading-tight italic">{d?.right}</div>
                </div>
            ))}
        </div>
    );
}
