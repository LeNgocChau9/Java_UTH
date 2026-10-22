import type { ComponentPropsWithoutRef } from "react";

export const DOCUMENT_STATUSES = [
  "Draft",
  "Review",
  "Approved",
  "Published",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const statusStyles: Record<DocumentStatus, string> = {
  Draft: "border-slate-200 bg-slate-100 text-slate-700",
  Review: "border-amber-200 bg-amber-50 text-amber-800",
  Approved: "border-sky-200 bg-sky-50 text-sky-800",
  Published: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

type StatusBadgeProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  status: DocumentStatus;
};

export function StatusBadge({
  status,
  className,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-4 ${statusStyles[status]} ${className ?? ""}`.trim()}
    >
      {status}
    </span>
  );
}
