import type { LucideIcon } from "lucide-react";

type NavItemProps = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

export function NavItem({ label, icon: Icon, active = false }: NavItemProps) {
  return (
    <button
      className={`topnav__item${active ? " topnav__item--active" : ""}`}
      type="button"
      aria-current={active ? "page" : undefined}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </button>
  );
}
