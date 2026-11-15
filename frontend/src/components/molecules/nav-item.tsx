import type { LucideIcon } from "lucide-react";

type NavItemProps = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick: () => void;
};

export function NavItem({ label, icon: Icon, active = false, onClick }: NavItemProps) {
  return (
    <button
      className={`topnav__item${active ? " topnav__item--active" : ""}`}
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </button>
  );
}
