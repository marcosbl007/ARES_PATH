import {
  BarChart3,
  Cloud,
  CloudDownload,
  Download,
  Map as MapIcon,
  SlidersHorizontal,
} from "lucide-react";
import Image from "next/image";

import { NavItem } from "@/components/molecules/nav-item";

const navigationItems = [
  { label: "Traverse", icon: MapIcon, active: true },
  { label: "Parameters", icon: SlidersHorizontal, active: false },
  { label: "Telemetry", icon: BarChart3, active: false },
  { label: "Offline", icon: CloudDownload, active: false },
];

export function AppTopbar() {
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
          <NavItem key={item.label} {...item} />
        ))}
      </nav>

      <div className="topbar__actions">
        <span className="relay-status">
          <Cloud size={13} aria-hidden="true" /> API / PENDING
        </span>
        <button className="toolbar-button" type="button" disabled title="Available after a mission is saved">
          <Download size={13} aria-hidden="true" /> Export pack
        </button>
        <span className="operator-badge" aria-label="Operator interface placeholder">
          UI
        </span>
      </div>
    </header>
  );
}
