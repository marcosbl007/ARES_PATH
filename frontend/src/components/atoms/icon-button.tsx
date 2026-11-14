import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  tone?: "default" | "alert";
  size?: "sm" | "md";
};

export function IconButton({
  icon: Icon,
  label,
  active = false,
  tone = "default",
  size = "md",
  className,
  title,
  type = "button",
  ...buttonProps
}: IconButtonProps) {
  const classes = [
    "icon-button",
    `icon-button--${size}`,
    active ? "icon-button--active" : "",
    tone === "alert" ? "icon-button--alert" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...buttonProps}
      className={classes}
      type={type}
      aria-label={label}
      title={title ?? label}
    >
      <Icon size={size === "sm" ? 14 : 16} aria-hidden="true" />
    </button>
  );
}
