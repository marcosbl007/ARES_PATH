import type { ReactNode } from "react";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "pending" | "ready" | "muted";
  className?: string;
};

export function StatusBadge({ children, tone = "muted", className }: StatusBadgeProps) {
  const classes = ["state-badge", `state-badge--${tone}`, className ?? ""]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{children}</span>;
}
