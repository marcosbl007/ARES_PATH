import type { AnalysisWindow, GridPoint, RegionMetadata } from "@/shared/types/api-contract";

export const MIN_ANALYSIS_WINDOW_CELLS = 32;
export const MAX_ANALYSIS_WINDOW_CELLS = 512;

export function createCenteredAnalysisWindow(
  metadata: RegionMetadata,
  preferredSize = MAX_ANALYSIS_WINDOW_CELLS,
): AnalysisWindow {
  const [height, width] = metadata.shape;
  const size = Math.max(1, Math.min(preferredSize, MAX_ANALYSIS_WINDOW_CELLS, height, width));
  return {
    row: Math.floor((height - size) / 2),
    col: Math.floor((width - size) / 2),
    height: size,
    width: size,
  };
}

export function createDefaultAnalysisWindow(metadata: RegionMetadata): AnalysisWindow {
  return createCenteredAnalysisWindow(metadata);
}

export function normalizeAnalysisWindow(
  window: AnalysisWindow,
  metadata: RegionMetadata,
): AnalysisWindow {
  const [height, width] = metadata.shape;
  const normalizedHeight = Math.min(
    height,
    MAX_ANALYSIS_WINDOW_CELLS,
    Math.max(Math.min(MIN_ANALYSIS_WINDOW_CELLS, height), Math.round(window.height)),
  );
  const normalizedWidth = Math.min(
    width,
    MAX_ANALYSIS_WINDOW_CELLS,
    Math.max(Math.min(MIN_ANALYSIS_WINDOW_CELLS, width), Math.round(window.width)),
  );
  return {
    row: Math.min(Math.max(0, Math.round(window.row)), height - normalizedHeight),
    col: Math.min(Math.max(0, Math.round(window.col)), width - normalizedWidth),
    height: normalizedHeight,
    width: normalizedWidth,
  };
}

export function isPointInAnalysisWindow(point: GridPoint, window: AnalysisWindow): boolean {
  return point.row >= window.row
    && point.row < window.row + window.height
    && point.col >= window.col
    && point.col < window.col + window.width;
}

