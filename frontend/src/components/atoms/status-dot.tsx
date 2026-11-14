type StatusDotProps = {
  tone?: "blue" | "red" | "demo" | "muted";
  pulse?: boolean;
  className?: string;
};

export function StatusDot({ tone = "muted", pulse = true, className }: StatusDotProps) {
  const classes = [
    "status-dot",
    `status-dot--${tone}`,
    pulse ? "" : "status-dot--static",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} aria-hidden="true" />;
}
