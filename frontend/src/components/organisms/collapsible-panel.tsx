import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { IconButton } from "@/components/atoms/icon-button";

type CollapsiblePanelProps = {
  open: boolean;
  onToggle: () => void;
  side: "left" | "right";
  label: string;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function CollapsiblePanel({
  open,
  onToggle,
  side,
  label,
  children,
  className,
  id,
}: CollapsiblePanelProps) {
  const ToggleIcon = side === "left"
    ? open
      ? ChevronLeft
      : ChevronRight
    : open
      ? ChevronRight
      : ChevronLeft;

  const classes = [
    "collapsible-panel",
    `collapsible-panel--${side}`,
    open ? "collapsible-panel--open" : "collapsible-panel--closed",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside id={id} className={classes} aria-label={label}>
      <IconButton
        className={`panel-toggle panel-toggle--${side}`}
        icon={ToggleIcon}
        label={open ? `Collapse ${label}` : `Open ${label}`}
        onClick={onToggle}
        size="sm"
      />
      {children}
    </aside>
  );
}
