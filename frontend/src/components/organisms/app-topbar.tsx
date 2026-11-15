import {
  BarChart3,
  Cloud,
  CloudDownload,
  Download,
  Map as MapIcon,
  SlidersHorizontal,
  Smartphone,
} from "lucide-react";
import Image from "next/image";

import { NavItem } from "@/components/molecules/nav-item";
import type { NavigationTarget } from "@/components/molecules/navigation-target";

type AppTopbarProps = {
  apiStatus: "loading" | "online" | "error";
  activeTarget: NavigationTarget;
  onNavigate: (target: NavigationTarget) => void;
  canExportPack: boolean;
  onExportPack: () => void;
  canInstall: boolean;
  isInstalled: boolean;
  onInstall: () => void;
};

const navigationItems = [
  { label: "Traverse", target: "traverse" as const, icon: MapIcon },
  { label: "Parameters", target: "parameters" as const, icon: SlidersHorizontal },
  { label: "Telemetry", target: "telemetry" as const, icon: BarChart3 },
  { label: "Offline", target: "offline" as const, icon: CloudDownload },
] satisfies Array<{ label: string; target: NavigationTarget; icon: typeof MapIcon }>;

export function AppTopbar({
  apiStatus,
  activeTarget,
  onNavigate,
  canExportPack,
  onExportPack,
  canInstall,
  isInstalled,
  onInstall,
}: AppTopbarProps) {
  const apiLabel = apiStatus === "online" ? "API / ONLINE" : apiStatus === "error" ? "API / ERROR" : "API / CONNECTING";

  return (
    <header className="topbar">
      <div className="topbar__identity">
        <div className="brand-lockup">
          <Image
            className="brand-lockup__logo"
            src="/brand/ares-path-logo-rectangular.png"
            alt="ARES PATH"
            width={172}
            height={44}
            priority
          />
        </div>
        <div className="mission-attribution" aria-label="ARES PATH by TUKTUK INTERGALATICO">
          <span className="mission-attribution__divider">|</span>
          <strong>by TUKTUK INTERGALATICO</strong>
        </div>
      </div>

      <nav className="topnav" aria-label="Primary navigation">
        {navigationItems.map((item) => (
          <NavItem
            key={item.label}
            label={item.label}
            icon={item.icon}
            active={activeTarget === item.target}
            onClick={() => onNavigate(item.target)}
          />
        ))}
      </nav>

      <div className="topbar__actions">
        <span className="relay-status">
          <Cloud size={13} aria-hidden="true" /> {apiLabel}
        </span>
        <button
          className="toolbar-button"
          type="button"
          disabled={!canExportPack}
          title={canExportPack ? "Export the current Mission Pack" : "Plan a mission before exporting a pack"}
          onClick={onExportPack}
        >
          <Download size={13} aria-hidden="true" /> Export pack
        </button>
        <button
          className="toolbar-button toolbar-button--install"
          type="button"
          disabled={isInstalled || !canInstall}
          title={isInstalled ? "ARES PATH is installed" : "Install ARES PATH"}
          onClick={onInstall}
        >
          <Smartphone size={13} aria-hidden="true" /> {isInstalled ? "Installed" : "Install app"}
        </button>
      </div>
    </header>
  );
}
