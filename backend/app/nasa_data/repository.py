"""Offline region services and optional domain router for P4."""
import json
import os
from pathlib import Path

import numpy as np
import rasterio
from fastapi import APIRouter, HTTPException

from .loader import load_elevation_data
from .processor import sha256, validate_region_id
from .schemas import RegionData


class RegionRepository:
    def __init__(self, data_dir: str | Path | None = None):
        self.data_dir = Path(data_dir or os.environ.get("ARES_DATA_DIR") or
                             Path(__file__).resolve().parents[2] / "data")

    def _path(self, region_id: str) -> Path:
        validate_region_id(region_id)
        return self.data_dir / "processed" / f"{region_id}_elevation.tif"

    def get_region_metadata(self, region_id: str) -> dict:
        path = self._path(region_id)
        if not path.with_suffix(".json").is_file():
            raise KeyError(region_id)
        if not path.is_file():
            raise FileNotFoundError("Processed DTM unavailable")
        metadata = json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
        if metadata["region_id"] != region_id:
            raise ValueError("Region metadata identifier mismatch")
        return metadata

    def get_region(self, region_id: str) -> RegionData:
        metadata = self.get_region_metadata(region_id)
        path = self._path(region_id)
        if sha256(path) != metadata["processed_sha256"]:
            raise ValueError("Processed raster checksum mismatch")
        region = load_elevation_data(path, region_id=region_id,
                                     source_ids=tuple(metadata["source_ids"]))
        if (list(region.elevation_m.shape) != metadata["shape"] or
                list(region.transform)[:6] != metadata["transform"] or
                region.crs_wkt != metadata["crs_wkt"] or
                region.pixel_size_x_m != metadata["pixel_size_x_m"] or
                region.pixel_size_y_m != metadata["pixel_size_y_m"] or
                int(region.valid_mask.sum()) != metadata["valid_cells"]):
            raise ValueError("Raster and metadata disagree")
        return RegionData(region.region_id, region.elevation_m, region.valid_mask,
                          region.transform, region.crs_wkt, region.pixel_size_x_m,
                          region.pixel_size_y_m, region.source_ids, metadata)

    def get_elevation_grid(self, region_id: str) -> np.ndarray:
        return self.get_region(region_id).elevation_m

    def get_available_layers(self, region_id: str) -> list[dict]:
        metadata = self.get_region_metadata(region_id)
        layers = [{"layer_id": "elevation", "units": "m", "type": "raster",
                   "source_ids": metadata["source_ids"], "used_for_routing": True}]
        ortho_path = self._path(region_id).with_name(f"{region_id}_orthoimage.tif")
        if ortho_path.is_file() and ortho_path.with_suffix('.json').is_file():
            ortho = json.loads(ortho_path.with_suffix('.json').read_text(encoding='utf-8'))
            if (ortho['region_id'] != region_id or ortho['dtm_sha256'] != metadata['processed_sha256']
                    or sha256(ortho_path) != ortho['processed_sha256']):
                raise ValueError("Ortho provenance mismatch")
            with rasterio.open(ortho_path) as src:
                if (list(src.shape) != metadata['shape'] or list(src.transform)[:6] != metadata['transform']
                        or src.crs.to_wkt() != metadata['crs_wkt']):
                    raise ValueError("Ortho grid mismatch")
            layers.append({"layer_id": "orthoimage", "units": "DN", "type": "raster",
                           "source_ids": ortho['source_ids'], "used_for_routing": False,
                           "alignment_status": ortho['alignment_status']})
        return layers

    def list_regions(self) -> list[dict]:
        results = []
        for path in sorted((self.data_dir / "processed").glob("*_elevation.json")):
            region_id = path.name.removesuffix("_elevation.json")
            if self._path(region_id).is_file():
                results.append(self.get_region_metadata(region_id))
        return results


def get_region_metadata(region_id: str) -> dict:
    return RegionRepository().get_region_metadata(region_id)


def get_elevation_grid(region_id: str) -> np.ndarray:
    return RegionRepository().get_elevation_grid(region_id)


def get_available_layers(region_id: str) -> list[dict]:
    return RegionRepository().get_available_layers(region_id)


def create_router(repository: RegionRepository | None = None) -> APIRouter:
    repo = repository or RegionRepository()
    domain_router = APIRouter(prefix="/data", tags=["NASA data"])

    def invoke(function, *args):
        try:
            return function(*args)
        except KeyError:
            raise HTTPException(404, detail={"code": "REGION_NOT_FOUND", "message": "Unknown region", "details": {}})
        except FileNotFoundError:
            raise HTTPException(503, detail={"code": "DTM_UNAVAILABLE", "message": "DTM unavailable", "details": {}})
        except ValueError:
            raise HTTPException(409, detail={"code": "INVALID_DATA", "message": "Invalid region data", "details": {}})

    @domain_router.get("/regions")
    def regions() -> list[dict]:
        return invoke(repo.list_regions)

    @domain_router.get("/regions/{region_id}")
    def metadata(region_id: str) -> dict:
        return invoke(repo.get_region_metadata, region_id)

    @domain_router.get("/regions/{region_id}/layers")
    def layers(region_id: str) -> list[dict]:
        return invoke(repo.get_available_layers, region_id)

    return domain_router


router = create_router()
