"""Slope calculations on a georeferenced elevation grid."""

from __future__ import annotations

import numpy as np

from app.terrain.schemas import RegionDataLike, validate_region_arrays


def _axis_gradient(
    elevation_m: np.ndarray,
    valid_mask: np.ndarray,
    spacing_m: float,
    axis: int,
) -> np.ndarray:
    """Compute a finite difference, leaving unsupported cells as NaN.

    Interior samples use a centered difference. Raster edges use a one-sided
    difference. If any required in-bounds neighbor is NoData, the derivative
    is unknown instead of being silently treated as zero or one-sided.
    """

    values = np.moveaxis(elevation_m, axis, 0)
    valid = np.moveaxis(valid_mask, axis, 0)
    gradient = np.full(values.shape, np.nan, dtype=np.float64)
    if values.shape[0] < 2:
        return np.moveaxis(gradient, 0, axis)

    first_ok = valid[0] & valid[1]
    gradient[0][first_ok] = (values[1][first_ok] - values[0][first_ok]) / spacing_m

    last_ok = valid[-1] & valid[-2]
    gradient[-1][last_ok] = (values[-1][last_ok] - values[-2][last_ok]) / spacing_m

    for index in range(1, values.shape[0] - 1):
        neighbors_ok = valid[index - 1] & valid[index] & valid[index + 1]
        gradient[index][neighbors_ok] = (
            values[index + 1][neighbors_ok] - values[index - 1][neighbors_ok]
        ) / (2.0 * spacing_m)

    return np.moveaxis(gradient, 0, axis)


def calculate_slope(region: RegionDataLike) -> np.ndarray:
    """Return slope in degrees for ``region``; unsupported cells are NaN.

    ``pixel_size_y_m`` is used for row gradients and ``pixel_size_x_m`` for
    column gradients, so rectangular cells are handled correctly. The result
    is a terrain gradient, not a physical safety or mobility score.
    """

    elevation_m, valid_mask, pixel_x_m, pixel_y_m = validate_region_arrays(region)
    if elevation_m.shape[0] < 2 or elevation_m.shape[1] < 2:
        raise ValueError("Slope calculation requires at least two rows and two columns.")

    dz_dy = _axis_gradient(elevation_m, valid_mask, pixel_y_m, axis=0)
    dz_dx = _axis_gradient(elevation_m, valid_mask, pixel_x_m, axis=1)
    supported = valid_mask & np.isfinite(dz_dy) & np.isfinite(dz_dx)

    slope_deg = np.full(elevation_m.shape, np.nan, dtype=np.float64)
    slope_deg[supported] = np.degrees(
        np.arctan(np.hypot(dz_dx[supported], dz_dy[supported]))
    )
    return slope_deg


__all__ = ["calculate_slope"]
