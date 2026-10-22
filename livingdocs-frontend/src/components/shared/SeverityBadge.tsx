import type { ComponentPropsWithoutRef } from "react";

export const SEVERITY_LEVELS = ["Low", "Medium", "High", "Critical"] as const;

export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

const severityStyles: Record<SeverityLevel, string> = {
  Low: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Medium: "border-amber-200 bg-amber-50 text-amber-800",
  High: "border-orange-200 bg-orange-50 text-orange-800",
  Critical: "border-red-200 bg-red-50 text-red-800",
};

type SeverityBadgeProps = Omit<
  ComponentPropsWithoutRef<"span">,
  "children"
> & {
  severity: SeverityLevel;
};

export function SeverityBadge({
  severity,
  className,
  ...props
}: SeverityBadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-4 ${severityStyles[severity]} ${className ?? ""}`.trim()}
    >
      {severity}
    </span>
  );
}
