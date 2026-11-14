import type { ReactNode } from "react";

type PanelHeadingProps = {
  eyebrow: string;
  title: string;
  eyebrowAccessory?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function PanelHeading({
  eyebrow,
  title,
  eyebrowAccessory,
  action,
  className,
}: PanelHeadingProps) {
  const classes = ["panel-heading", className ?? ""].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <div>
        <p className="eyebrow">
          {eyebrowAccessory}
          {eyebrow}
        </p>
        <h2>{title}</h2>
      </div>
      {action ? <div className="panel-heading__action">{action}</div> : null}
    </div>
  );
}
