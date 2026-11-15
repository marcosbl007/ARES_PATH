import {
  Activity,
  Globe2,
  Layers,
  Route,
  Target,
} from "lucide-react";

import { IconButton } from "@/components/atoms/icon-button";
import type { NavigationTarget } from "@/components/molecules/navigation-target";

const railItems = [
  { label: "Region", target: "region" as const, icon: Globe2 },
  { label: "Layers", target: "layers" as const, icon: Layers },
  { label: "Routes", target: "routes" as const, icon: Route },
  { label: "Targets", target: "targets" as const, icon: Target },
  { label: "Telemetry", target: "telemetry" as const, icon: Activity },
] satisfies Array<{ label: string; target: NavigationTarget; icon: typeof Globe2 }>;

type WorkspaceRailProps = {
  activeTarget: NavigationTarget;
  onNavigate: (target: NavigationTarget) => void;
};

export function WorkspaceRail({ activeTarget, onNavigate }: WorkspaceRailProps) {
  return (
    <aside className="side-rail" aria-label="Workspace tools">
      <div className="side-rail__group">
        {railItems.map(({ label, target, icon }) => (
          <IconButton
            key={label}
            className={`rail-button${activeTarget === target ? " rail-button--active" : ""}`}
            icon={icon}
            label={label}
            active={activeTarget === target}
            size="sm"
            onClick={() => onNavigate(target)}
          />
        ))}
      </div>
    </aside>
  );
}
