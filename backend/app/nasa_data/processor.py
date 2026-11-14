"""Crop real local rasters without resampling; persist data and provenance."""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import rasterio
import numpy as np
from affine import Affine
from rasterio.windows import Window

from .loader import load_elevation_data


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_region_id(region_id: str) -> None:
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", region_id):
        raise ValueError("Invalid region_id")


def process_elevation_data(path: str | Path, region_id: str, source_id: str,
                           window: Window, data_dir: str | Path | None = None) -> Path:
    validate_region_id(region_id)
    root = Path(data_dir) if data_dir else Path(__file__).resolve().parents[2] / "data"
    catalog = json.loads((root / "sources.json").read_text(encoding="utf-8"))
    source = catalog["sources"][source_id]
    region = load_elevation_data(path, region_id=region_id, source_ids=(source_id,),
                                 vertical_units=source["vertical_units"], window=window)
    if "shape" in source and region.metadata["original_shape"] != source["shape"]:
        raise ValueError("Source raster dimensions disagree with catalog")
    if "pds_map_scale_m" in source and abs(region.pixel_size_x_m - source["pds_map_scale_m"]) > 1e-9:
        raise ValueError("Source raster resolution disagrees with catalog")
    output = root / "processed" / f"{region_id}_elevation.tif"
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() or output.with_suffix(".json").exists():
        raise FileExistsError("Region identifiers are immutable; choose a new region_id")
    with rasterio.open(output, "w", driver="GTiff", height=region.elevation_m.shape[0],
                       width=region.elevation_m.shape[1], count=1, dtype="float64",
                       crs=region.crs_wkt, transform=region.transform, nodata=float("nan"),
                       compress="deflate") as dst:
        dst.write(region.elevation_m, 1)
        dst.set_band_unit(1, "m")
    metadata = dict(region.metadata, region_id=region_id, source_ids=[source_id],
                    source=source, shape=list(region.elevation_m.shape),
                    transform=list(region.transform)[:6], crs_wkt=region.crs_wkt,
                    pixel_size_x_m=region.pixel_size_x_m, pixel_size_y_m=region.pixel_size_y_m,
                    valid_cells=int(region.valid_mask.sum()),
                    map_bounds=list(rasterio.transform.array_bounds(
                        *region.elevation_m.shape, region.transform)),
                    source_sha256=sha256(Path(path)), processed_sha256=sha256(output),
                    processed_at=datetime.now(timezone.utc).isoformat(),
                    coordinate_system="grid_row_col")
    output.with_suffix(".json").write_text(json.dumps(metadata, indent=2, allow_nan=False), encoding="utf-8")
    return output


def process_orthoimage(path: str | Path, label_path: str | Path, region_id: str,
                       source_id: str, data_dir: str | Path | None = None) -> Path:
    """Register an associated RED ortho using its PDS grid, without resampling.

    This deliberately supports only a label whose grid is identical to the DTM.
    Embedded JP2 georeferencing can disagree with PDS; both are recorded.
    """
    from .repository import RegionRepository

    root = Path(data_dir) if data_dir else Path(__file__).resolve().parents[2] / "data"
    region = RegionRepository(root).get_region(region_id)
    source = json.loads((root / "sources.json").read_text(encoding="utf-8"))["sources"][source_id]
    label = Path(label_path).read_text(encoding="ascii")

    def field(name: str) -> str:
        match = re.search(r"^\s*" + re.escape(name) + r"\s*=\s*([^\r\n]+)", label, re.M)
        if not match:
            raise ValueError(f"PDS field missing: {name}")
        return match[1].strip().strip('"')

    def number(name: str) -> float:
        return float(field(name).split()[0])

    association = re.search(r"SOURCE_PRODUCT_ID\s*=\s*(\([^)]*\)|[^\r\n]+)", label, re.S)
    associated_ids = re.findall(r"[A-Za-z0-9_]+", association[1]) if association else []
    if field("PRODUCT_ID") != source_id or not all(s in associated_ids for s in region.source_ids):
        raise ValueError("PDS product is not associated with this DTM")
    if (field("TARGET_NAME") != "MARS" or field("MAP_PROJECTION_TYPE") != "EQUIRECTANGULAR"
            or field("POSITIVE_LONGITUDE_DIRECTION") != "EAST"
            or field("COORDINATE_SYSTEM_NAME") != "PLANETOCENTRIC"):
        raise ValueError("Unsupported PDS planetary reference frame")
    dtm_source = region.metadata["source"]
    for key, expected in [("CENTER_LATITUDE", dtm_source["projection_center_latitude_deg"]),
                          ("CENTER_LONGITUDE", dtm_source["projection_center_longitude_deg"]),
                          ("A_AXIS_RADIUS", dtm_source["sphere_radius_m"] / 1000),
                          ("B_AXIS_RADIUS", dtm_source["sphere_radius_m"] / 1000),
                          ("C_AXIS_RADIUS", dtm_source["sphere_radius_m"] / 1000),
                          ("MAP_PROJECTION_ROTATION", 0)]:
        if not np.isclose(number(key), expected, rtol=0, atol=1e-9):
            raise ValueError(f"PDS projection disagrees with DTM: {key}")
    scale = number("MAP_SCALE")
    if "<METERS/PIXEL>" not in field("MAP_SCALE") or any(
            "<KM>" not in field(k) for k in ("A_AXIS_RADIUS", "B_AXIS_RADIUS", "C_AXIS_RADIUS")):
        raise ValueError("PDS horizontal units are not documented as expected")
    # Same PDS pixel-edge interpretation used by GDAL for the original DTM IMG.
    pds_transform = Affine(scale, 0, -(number("SAMPLE_PROJECTION_OFFSET") + .5) * scale,
                           0, -scale, (number("LINE_PROJECTION_OFFSET") + .5) * scale)
    if not np.allclose(list(pds_transform)[:6], region.metadata["original_transform"],
                       rtol=0, atol=1e-8):
        raise ValueError("PDS ortho grid differs from original DTM; registration requires review")
    col, row, width, height = region.metadata["window_col_row_width_height"]
    output = root / "processed" / f"{region_id}_orthoimage.tif"
    if output.exists() or output.with_suffix('.json').exists():
        raise FileExistsError(output)
    with rasterio.open(path) as src:
        if (list(src.shape) != region.metadata["original_shape"] or src.count != 1
                or src.dtypes[0] != "uint8"
                or [int(number("LINES")), int(number("LINE_SAMPLES"))] != list(src.shape)):
            raise ValueError("Unsupported ortho dimensions or bands")
        data = src.read(1, window=Window(col, row, width, height))
        # PDS declares 0 NULL; 1 and 255 are saturated. Exclude all three.
        valid = (src.read_masks(1, window=Window(col, row, width, height)) > 0)
        valid &= (data > 1) & (data < 255)
        if not valid.any():
            raise ValueError("Ortho crop has no valid pixels")
        embedded = {"crs_wkt": src.crs.to_wkt() if src.crs else None,
                    "transform": list(src.transform)[:6]}
    with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=True):
        with rasterio.open(output, 'w', driver='GTiff', height=height, width=width,
                           count=1, dtype='uint8', transform=region.transform,
                           crs=region.crs_wkt, compress='deflate') as dst:
            dst.write(data, 1)
            dst.write_mask(valid.astype('uint8') * 255)
    checkpoints = []
    for r, c in [(0, 0), (height // 2, width // 2), (height - 1, width - 1)]:
        xy = region.cell_center(r, c)
        original_xy = pds_transform * (col + c + .5, row + r + .5)
        if not np.allclose(xy, original_xy, rtol=0, atol=1e-8):
            raise ValueError("Grid checkpoint mismatch")
        checkpoints.append({"row_col": [r, c], "map_xy": list(xy),
                            "pds_original_row_col": [row + r, col + c]})
    metadata = dict(region_id=region_id, layer_id="orthoimage", source_ids=[source_id],
                    source=source, shape=[height, width], crs_wkt=region.crs_wkt,
                    transform=list(region.transform)[:6], original_jp2_georeferencing=embedded,
                    georeferencing_method="PDS label grid interpreted as original DTM IMG by GDAL",
                    resampling="none; integer window; DTM unchanged", units="DN",
                    invalid_dn=[0, 1, 255], valid_pixels=int(valid.sum()),
                    radiometric_scale=number("SCALING_FACTOR"), radiometric_offset=number("OFFSET"),
                    source_sha256=sha256(Path(path)), label_sha256=sha256(Path(label_path)),
                    processed_sha256=sha256(output), dtm_sha256=region.metadata["processed_sha256"],
                    grid_checkpoints=checkpoints, alignment_status="PDS grid verified; independent visual review pending",
                    processed_at=datetime.now(timezone.utc).isoformat())
    output.with_suffix('.json').write_text(json.dumps(metadata, indent=2, allow_nan=False), encoding='utf-8')
    return output


def create_alignment_preview(region_id: str, data_dir: str | Path | None = None) -> Path:
    """Diagnostic PNG: RED ortho, computed hillshade, and 50/50 overlay.

    Hillshade is for inspection only, with an arbitrary light direction. It is
    not a measured optical layer and does not change the elevation grid.
    """
    from .repository import RegionRepository

    repo = RegionRepository(data_dir)
    region = repo.get_region(region_id)
    if not any(layer['layer_id'] == 'orthoimage' for layer in repo.get_available_layers(region_id)):
        raise FileNotFoundError("Aligned orthoimage unavailable")
    root = repo.data_dir / 'processed'
    with rasterio.open(root / f'{region_id}_orthoimage.tif') as src:
        ortho = src.read(1)
        valid = (src.read_masks(1) > 0) & region.valid_mask
    if min(region.elevation_m.shape) < 3:
        raise ValueError("Preview requires at least 3x3 cells")
    gy, gx = np.gradient(region.elevation_m, region.pixel_size_y_m, region.pixel_size_x_m)
    # Surface normal in map axes: x=east, y=north, z=up (rows increase south).
    normal = np.stack((-gx, gy, np.ones_like(gx)))
    normal /= np.sqrt((normal ** 2).sum(axis=0))
    light = np.array([-0.5, 0.5, np.sqrt(0.5)])
    shade = (normal * light[:, None, None]).sum(axis=0)
    # Stretch for diagnostic visibility; not a physical reflectance measurement.
    good = valid & np.isfinite(shade)
    if not good.any():
        raise ValueError("No valid hillshade neighbourhood")
    low, high = np.percentile(shade[good], [2, 98])
    hill = np.nan_to_num(np.clip((shade - low) / max(high - low, 1e-12), 0, 1) * 255).astype('uint8')
    hill[~good] = 0
    optical = ortho.copy()
    optical[~valid] = 0
    overlay = ((optical.astype(float) + hill) * .5).astype('uint8')
    overlay[~good] = 0
    panels = np.concatenate((optical, hill, overlay), axis=1)
    output = root / f'{region_id}_alignment_preview.png'
    with rasterio.open(output, 'w', driver='PNG', count=1, dtype='uint8',
                       height=panels.shape[0], width=panels.shape[1]) as dst:
        dst.write(panels, 1)
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--region-id", required=True)
    parser.add_argument("--source-id", required=True)
    parser.add_argument("--window", type=int, nargs=4, required=True,
                        metavar=("COL", "ROW", "WIDTH", "HEIGHT"))
    parser.add_argument("--data-dir", type=Path)
    args = parser.parse_args()
    print(process_elevation_data(args.path, args.region_id, args.source_id,
                                 Window(*args.window), args.data_dir))
