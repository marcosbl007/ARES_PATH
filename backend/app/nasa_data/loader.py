"""Strict local DTM loading. No network access or terrestrial reprojection."""
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

from .schemas import RegionData


def load_elevation_data(
    path: str | Path, *, region_id: str, source_ids: tuple[str, ...],
    vertical_units: str | None = None, window: Window | None = None,
) -> RegionData:
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(path)
    with rasterio.open(path) as src:
        crs = src.crs
        if crs is None or not crs.is_projected:
            raise ValueError("DTM requires a documented projected Mars CRS")
        if "mars" not in crs.to_wkt().lower():
            raise ValueError("CRS does not identify Mars")
        if crs.linear_units_factor[1] != 1.0:
            raise ValueError("Horizontal units must be metres")
        if src.count != 1:
            raise ValueError("Expected a single elevation band")
        unit = src.units[0] or vertical_units
        if unit not in ("m", "meter", "metre", "meters", "metres"):
            raise ValueError("Vertical units must be documented as metres")
        if vertical_units and src.units[0] and src.units[0] != vertical_units:
            raise ValueError("Conflicting vertical units")
        if window is None:
            window = Window(0, 0, src.width, src.height)
        vals = (window.col_off, window.row_off, window.width, window.height)
        if (any(v != int(v) for v in vals) or min(vals[:2]) < 0
                or min(vals[2:]) <= 0 or window.col_off + window.width > src.width
                or window.row_off + window.height > src.height):
            raise ValueError("Crop must be an integer window inside the source")
        transform = src.window_transform(window)
        if transform.b != 0 or transform.d != 0 or transform.a <= 0 or transform.e >= 0:
            raise ValueError("Only north-up, unrotated metric grids are supported")
        band = src.read(1, window=window, masked=True)
        elevation = band.astype(np.float64).filled(np.nan)
        elevation = elevation * src.scales[0] + src.offsets[0]
        valid = np.isfinite(elevation)
        elevation[~valid] = np.nan
        metadata = {
            "original_shape": [src.height, src.width], "original_dtype": src.dtypes[0],
            "original_nodata": str(src.nodata), "original_transform": list(src.transform)[:6],
            "original_crs_wkt": crs.to_wkt(), "original_tags": src.tags(),
            "original_scale": src.scales[0], "original_offset": src.offsets[0],
            "vertical_units": "m", "horizontal_units": "m",
            "vertical_units_evidence": "band metadata" if src.units[0] else "source catalog",
            "window_col_row_width_height": list(vals), "resampling": "none",
        }
        return RegionData(region_id, elevation, valid, transform, crs.to_wkt(),
                          transform.a, -transform.e, source_ids, metadata)
