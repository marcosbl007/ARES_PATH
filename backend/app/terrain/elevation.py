"""Elevation profiles and per-route relief metrics."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

import numpy as np

from app.terrain.schemas import (
    ElevationProfile,
    GridPoint,
    RegionDataLike,
    validate_region_arrays,
)


def _normalize_grid_path(path: Sequence[GridPoint | Mapping[str, object]]) -> tuple[GridPoint, ...]:
    if len(path) == 0:
        raise ValueError("grid_path must contain at least one point.")

    points: list[GridPoint] = []
    for index, point in enumerate(path):
        if isinstance(point, Mapping):
            row_value = point.get("row")
            col_value = point.get("col")
        else:
            try:
                row_value, col_value = point
            except (TypeError, ValueError) as exc:
                raise ValueError(f"grid_path point {index} must be a (row, col) pair.") from exc

        if (
            isinstance(row_value, (bool, np.bool_))
            or isinstance(col_value, (bool, np.bool_))
            or not isinstance(row_value, (int, np.integer))
            or not isinstance(col_value, (int, np.integer))
        ):
            raise ValueError(f"grid_path point {index} row and col must be integers.")
        points.append((int(row_value), int(col_value)))
    return tuple(points)


def calculate_elevation_profile(
    region: RegionDataLike,
    grid_path: Sequence[GridPoint | Mapping[str, object]],
) -> ElevationProfile:
    """Calculate sampled elevations, distance, ascent, descent, and max slope.

    The path uses zero-based ``(row, col)`` cells. Consecutive samples must be
    neighboring cells in an 8-connected grid, and every referenced cell must
    contain valid elevation data.
    """

    elevation_m, valid_mask, pixel_x_m, pixel_y_m = validate_region_arrays(region)
    points = _normalize_grid_path(grid_path)
    height, width = elevation_m.shape

    for index, (row, col) in enumerate(points):
        if not (0 <= row < height and 0 <= col < width):
            raise ValueError(f"grid_path point {index} ({row}, {col}) is outside the elevation grid.")
        if not valid_mask[row, col]:
            raise ValueError(f"grid_path point {index} ({row}, {col}) has no valid elevation data.")

    cumulative_distance = [0.0]
    elevations = [float(elevation_m[points[0]])]
    ascent_m = 0.0
    descent_m = 0.0
    max_slope_deg = 0.0

    for previous, current in zip(points, points[1:]):
        delta_row = current[0] - previous[0]
        delta_col = current[1] - previous[1]
        if delta_row == 0 and delta_col == 0:
            raise ValueError("grid_path cannot repeat the same cell consecutively.")
        if abs(delta_row) > 1 or abs(delta_col) > 1:
            raise ValueError("Consecutive grid_path points must be 8-connected neighbors.")

        segment_distance_m = float(np.hypot(delta_col * pixel_x_m, delta_row * pixel_y_m))
        previous_elevation = float(elevation_m[previous])
        current_elevation = float(elevation_m[current])
        delta_elevation = current_elevation - previous_elevation
        ascent_m += max(delta_elevation, 0.0)
        descent_m += max(-delta_elevation, 0.0)
        max_slope_deg = max(
            max_slope_deg,
            float(np.degrees(np.arctan2(abs(delta_elevation), segment_distance_m))),
        )
        cumulative_distance.append(cumulative_distance[-1] + segment_distance_m)
        elevations.append(current_elevation)

    return ElevationProfile(
        grid_path=points,
        cumulative_distance_m=tuple(cumulative_distance),
        elevation_m=tuple(elevations),
        distance_m=cumulative_distance[-1],
        ascent_m=ascent_m,
        descent_m=descent_m,
        max_slope_deg=max_slope_deg,
    )


__all__ = ["calculate_elevation_profile"]
