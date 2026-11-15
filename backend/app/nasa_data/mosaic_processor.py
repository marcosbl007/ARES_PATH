"""Prepare aligned regional datasets from the official Jezero CTX mosaics."""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject
from rasterio.windows import Window

from .processor import process_elevation_data, sha256
from .repository import RegionRepository


CTX_DTM_SOURCE_ID = "MARS2020_CTX_JEZERO_DTM_20M"
CTX_ORTHO_SOURCE_ID = "MARS2020_CTX_JEZERO_ORTHO_5M"
CTX_DTM_FILENAME = "M20_JezeroCrater_CTXDEM_20m.tif"
CTX_ORTHO_FILENAME = "M20_JezeroCrater_CTXortho_mosaic_5m.tif"


def _default_root(data_dir: str | Path | None = None) -> Path:
    return Path(data_dir) if data_dir else Path(__file__).resolve().parents[2] / "data"


def _intersection_window(dtm_path: Path, ortho_path: Path) -> Window:
    """Return the largest north-up DTM window fully covered by the orthoimage."""

    with rasterio.open(dtm_path) as dtm, rasterio.open(ortho_path) as ortho:
        if dtm.crs is None or ortho.crs is None:
            raise ValueError("Both CTX mosaics require a projected Mars CRS")
        # The two USGS files use different WKT names but the same Mars
        # equirectangular parameters. Compare normalized PROJ dictionaries so
        # harmless product naming differences do not block alignment.
        if dtm.crs.to_dict() != ortho.crs.to_dict():
            raise ValueError("CTX DTM and orthoimage CRS must match before alignment")
        if dtm.transform.b != 0 or dtm.transform.d != 0:
            raise ValueError("CTX DTM must be an unrotated north-up raster")

        left = max(dtm.bounds.left, ortho.bounds.left)
        right = min(dtm.bounds.right, ortho.bounds.right)
        top = min(dtm.bounds.top, ortho.bounds.top)
        bottom = max(dtm.bounds.bottom, ortho.bounds.bottom)
        x_resolution = dtm.transform.a
        y_resolution = -dtm.transform.e
        col_start = max(0, math.ceil((left - dtm.bounds.left) / x_resolution - 1e-9))
        col_stop = min(dtm.width, math.floor((right - dtm.bounds.left) / x_resolution + 1e-9))
        row_start = max(0, math.ceil((dtm.bounds.top - top) / y_resolution - 1e-9))
        row_stop = min(dtm.height, math.floor((dtm.bounds.top - bottom) / y_resolution + 1e-9))

    width = col_stop - col_start
    height = row_stop - row_start
    if width <= 0 or height <= 0:
        raise ValueError("CTX DTM and orthoimage do not overlap")
    return Window(col_start, row_start, width, height)


def regional_windows(dtm_path: str | Path, ortho_path: str | Path) -> dict[str, Window]:
    """Split the common CTX coverage into four large compass regions."""

    common = _intersection_window(Path(dtm_path), Path(ortho_path))
    row_mid = int(common.row_off + common.height // 2)
    col_mid = int(common.col_off + common.width // 2)
    row_start = int(common.row_off)
    col_start = int(common.col_off)
    row_end = row_start + int(common.height)
    col_end = col_start + int(common.width)
    return {
        "jezero_ctx_northwest_20m": Window(col_start, row_start, col_mid - col_start, row_mid - row_start),
        "jezero_ctx_northeast_20m": Window(col_mid, row_start, col_end - col_mid, row_mid - row_start),
        "jezero_ctx_southwest_20m": Window(col_start, row_mid, col_mid - col_start, row_end - row_mid),
        "jezero_ctx_southeast_20m": Window(col_mid, row_mid, col_end - col_mid, row_end - row_mid),
    }


def process_ctx_orthoimage(
    path: str | Path,
    region_id: str,
    *,
    data_dir: str | Path | None = None,
    source_sha256: str | None = None,
) -> Path:
    """Resample a CTX orthoimage onto the selected CTX DTM grid."""

    root = _default_root(data_dir)
    repository = RegionRepository(root)
    region = repository.get_region(region_id)
    catalog = json.loads((root / "sources.json").read_text(encoding="utf-8"))
    source = catalog["sources"][CTX_ORTHO_SOURCE_ID]
    output = root / "processed" / f"{region_id}_orthoimage.tif"
    if output.exists() or output.with_suffix(".json").exists():
        raise FileExistsError(f"Region identifiers are immutable: {region_id}")

    data = np.zeros(region.elevation_m.shape, dtype=np.uint8)
    with rasterio.open(path) as src:
        if src.count != 1 or src.dtypes[0] != "uint8":
            raise ValueError("CTX orthoimage must contain one uint8 band")
        reproject(
            source=rasterio.band(src, 1),
            destination=data,
            src_transform=src.transform,
            src_crs=src.crs,
            src_nodata=src.nodata,
            dst_transform=region.transform,
            dst_crs=region.crs_wkt,
            dst_nodata=0,
            resampling=Resampling.average,
        )
        embedded = {
            "shape": list(src.shape),
            "crs_wkt": src.crs.to_wkt() if src.crs else None,
            "transform": list(src.transform)[:6],
            "bounds": list(src.bounds),
        }

    valid = region.valid_mask & (data > 0)
    with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=True):
        with rasterio.open(
            output,
            "w",
            driver="GTiff",
            height=data.shape[0],
            width=data.shape[1],
            count=1,
            dtype="uint8",
            crs=region.crs_wkt,
            transform=region.transform,
            nodata=0,
            compress="deflate",
            predictor=2,
            tiled=True,
        ) as dst:
            dst.write(data, 1)
            dst.write_mask(valid.astype(np.uint8) * 255)

    metadata = {
        "region_id": region_id,
        "layer_id": "orthoimage",
        "source_ids": [CTX_ORTHO_SOURCE_ID],
        "source": source,
        "shape": list(data.shape),
        "crs_wkt": region.crs_wkt,
        "transform": list(region.transform)[:6],
        "units": "DN",
        "resampling": "average from 5 m CTX mosaic onto the 20 m DTM grid",
        "valid_pixels": int(valid.sum()),
        "original_ortho_georeferencing": embedded,
        "source_sha256": source_sha256 or sha256(Path(path)),
        "processed_sha256": sha256(output),
        "dtm_sha256": region.metadata["processed_sha256"],
        "alignment_status": "CTX orthoimage resampled to the selected DTM grid",
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    output.with_suffix(".json").write_text(
        json.dumps(metadata, indent=2, allow_nan=False), encoding="utf-8"
    )
    return output


def prepare_ctx_regions(data_dir: str | Path | None = None) -> list[str]:
    """Create four aligned, route-ready regional datasets from the CTX pair."""

    root = _default_root(data_dir)
    dtm_path = root / "raw" / CTX_DTM_FILENAME
    ortho_path = root / "raw" / CTX_ORTHO_FILENAME
    windows = regional_windows(dtm_path, ortho_path)
    dtm_hash = sha256(dtm_path)
    ortho_hash = sha256(ortho_path)
    created: list[str] = []
    for region_id, window in windows.items():
        process_elevation_data(
            dtm_path,
            region_id,
            CTX_DTM_SOURCE_ID,
            window,
            root,
        )
        process_ctx_orthoimage(
            ortho_path,
            region_id,
            data_dir=root,
            source_sha256=ortho_hash,
        )
        created.append(region_id)
        window_tuple = (
            int(window.col_off),
            int(window.row_off),
            int(window.width),
            int(window.height),
        )
        print(f"{region_id}: window={window_tuple} dtm={dtm_hash[:12]} ortho={ortho_hash[:12]}")
    return created


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default=None, help="Backend data directory")
    args = parser.parse_args()
    prepare_ctx_regions(args.data_dir)


if __name__ == "__main__":
    main()
