import type { GridPoint } from "@/shared/types/api-contract";

export type SvgViewport = {
  width: number;
  height: number;
  padding?: number;
};

export function gridPointToSvg(
  point: GridPoint,
  shape: [number, number] | undefined,
  viewport: SvgViewport,
) {
  if (!shape || shape[0] < 1 || shape[1] < 1) return null;

  const padding = viewport.padding ?? 44;
  const rows = shape[0];
  const columns = shape[1];

  return {
    x: padding + ((point.col + 0.5) / columns) * (viewport.width - padding * 2),
    y: padding + ((point.row + 0.5) / rows) * (viewport.height - padding * 2),
  };
}

export function gridPathToSvgPath(
  path: GridPoint[],
  shape: [number, number] | undefined,
  viewport: SvgViewport,
) {
  return path
    .map((point, index) => {
      const coordinate = gridPointToSvg(point, shape, viewport);
      if (!coordinate) return "";
      return `${index === 0 ? "M" : "L"} ${coordinate.x.toFixed(2)} ${coordinate.y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");
}
