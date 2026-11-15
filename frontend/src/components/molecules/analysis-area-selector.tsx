import { Check, Maximize2, Move, RotateCcw } from "lucide-react";

import type { RegionMetadata } from "@/shared/types/api-contract";
import type { AnalysisWindow } from "@/shared/types/api-contract";

type AnalysisAreaSelectorProps = {
  metadata: RegionMetadata | null;
  analysisWindow: AnalysisWindow | null;
  selectionActive: boolean;
  onToggleSelection: () => void;
  onReset: () => void;
};

export function AnalysisAreaSelector({
  metadata,
  analysisWindow,
  selectionActive,
  onToggleSelection,
  onReset,
}: AnalysisAreaSelectorProps) {
  const widthKm = metadata && analysisWindow
    ? (analysisWindow.width * metadata.pixel_size_x_m) / 1000
    : null;
  const heightKm = metadata && analysisWindow
    ? (analysisWindow.height * metadata.pixel_size_y_m) / 1000
    : null;

  return (
    <section className="analysis-area-panel" aria-label="Analysis area selector">
      <div className="analysis-area-panel__heading">
        <Maximize2 size={14} aria-hidden="true" />
        <div>
          <span className="analysis-area-panel__title">Analysis area</span>
          <span className="analysis-area-panel__subtitle">Move or resize the calculation window</span>
        </div>
      </div>
      <p className="analysis-area-panel__hint">
        Activate selection, then drag the yellow frame on the map. Drag a corner to resize it.
      </p>
      <div className="analysis-area-panel__metrics">
        <span><strong>{analysisWindow ? `${analysisWindow.width} × ${analysisWindow.height}` : "—"}</strong><small>cells</small></span>
        <span><strong>{widthKm !== null && heightKm !== null ? `${widthKm.toFixed(2)} × ${heightKm.toFixed(2)}` : "—"}</strong><small>km</small></span>
        <span><strong>{analysisWindow ? `R${analysisWindow.row} C${analysisWindow.col}` : "—"}</strong><small>origin</small></span>
      </div>
      <div className="analysis-area-panel__actions">
        <button
          className={selectionActive ? "analysis-area-action analysis-area-action--active" : "analysis-area-action"}
          type="button"
          onClick={onToggleSelection}
          disabled={!metadata || !analysisWindow}
        >
          {selectionActive ? <Check size={13} aria-hidden="true" /> : <Move size={13} aria-hidden="true" />}
          {selectionActive ? "Finish area selection" : "Edit area on map"}
        </button>
        <button
          className="analysis-area-action analysis-area-action--secondary"
          type="button"
          onClick={onReset}
          disabled={!metadata}
        >
          <RotateCcw size={13} aria-hidden="true" /> Reset centered
        </button>
      </div>
    </section>
  );
}

