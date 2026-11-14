import {
  Activity,
  Globe2,
  Layers,
  Route,
  Settings2,
  ShieldAlert,
  Target,
} from "lucide-react";

import { IconButton } from "@/components/atoms/icon-button";

const railItems = [
  { label: "Region", icon: Globe2 },
  { label: "Layers", icon: Layers, active: true },
  { label: "Routes", icon: Route },
  { label: "Targets", icon: Target },
  { label: "Telemetry", icon: Activity },
];

export function WorkspaceRail() {
  return (
    <aside className="side-rail" aria-label="Workspace tools">
      <div className="side-rail__group">
        {railItems.map(({ label, icon, active }) => (
          <IconButton
            key={label}
            className={`rail-button${active ? " rail-button--active" : ""}`}
            icon={icon}
            label={label}
            active={active}
            size="sm"
          />
        ))}
      </div>
      <div className="side-rail__group">
        <IconButton className="rail-button" icon={Settings2} label="Settings" size="sm" />
        <IconButton className="rail-button rail-button--alert" icon={ShieldAlert} label="Diagnostics" size="sm" tone="alert" />
      </div>
    </aside>
  );
}
