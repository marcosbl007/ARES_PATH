"""Offline region services and optional domain router for P4."""
import json
import os
from pathlib import Path

import numpy as np
import rasterio
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response

from .loader import load_elevation_data
from .mars_trek import get_verified_mars_trek_layers
from .processor import sha256, validate_region_id
from .raster_service import LayerNotFound, RasterAssetService
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
        def resource_fields(layer_id: str) -> dict[str, object]:
            return {
                "shape": metadata["shape"],
                "transform": metadata["transform"],
                "crs_wkt": metadata["crs_wkt"],
                "map_bounds": metadata.get("map_bounds"),
                "pixel_size_x_m": metadata["pixel_size_x_m"],
                "pixel_size_y_m": metadata["pixel_size_y_m"],
                "coordinate_system": "native_projected_mars",
                "metadata_url": f"/api/data/regions/{region_id}/layers/{layer_id}/metadata",
                "raster_url": f"/api/data/regions/{region_id}/layers/{layer_id}/raster",
                "preview_url": f"/api/data/regions/{region_id}/layers/{layer_id}/preview.png",
                "tile_url_template": (
                    f"/api/data/regions/{region_id}/layers/{layer_id}/tiles/{{z}}/{{x}}/{{y}}.png"
                ),
                "tile_scheme": "local_native_xyz",
                "tile_size": 256,
                "min_zoom": 0,
                "max_zoom": 12,
            }

        layers = [{
            "layer_id": "elevation",
            "units": "m",
            "type": "raster",
            "source_ids": metadata["source_ids"],
            "used_for_routing": True,
            **resource_fields("elevation"),
        }]
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
            layers.append({
                "layer_id": "orthoimage",
                "units": "DN",
                "type": "raster",
                "source_ids": ortho['source_ids'],
                "used_for_routing": False,
                "alignment_status": ortho['alignment_status'],
                **resource_fields("orthoimage"),
            })
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

    raster_service = (
        RasterAssetService(repo.data_dir)
        if isinstance(repo, RegionRepository)
        else None
    )

    def require_raster_service() -> RasterAssetService:
        if raster_service is None:
            raise HTTPException(
                503,
                detail={
                    "code": "RASTER_UNAVAILABLE",
                    "message": "Binary raster serving requires a filesystem-backed region repository.",
                    "details": {},
                },
            )
        return raster_service

    @domain_router.get("/mars-trek/layers")
    def mars_trek_layers() -> list[dict[str, object]]:
        return get_verified_mars_trek_layers()

    def invoke_raster(function, region_id: str, layer_id: str):
        try:
            return function(region_id, layer_id)
        except LayerNotFound:
            raise HTTPException(
                404,
                detail={
                    "code": "LAYER_NOT_FOUND",
                    "message": "The requested raster layer is not available for this region.",
                    "details": {"region_id": region_id, "layer_id": layer_id},
                },
            )
        except KeyError:
            raise HTTPException(
                404,
                detail={"code": "REGION_NOT_FOUND", "message": "Unknown region", "details": {}},
            )
        except FileNotFoundError:
            raise HTTPException(
                503,
                detail={"code": "RASTER_UNAVAILABLE", "message": "Raster unavailable", "details": {}},
            )
        except ValueError as error:
            raise HTTPException(
                409,
                detail={"code": "INVALID_DATA", "message": str(error), "details": {}},
            )

    @domain_router.get("/regions/{region_id}/layers/{layer_id}/metadata")
    def layer_metadata(region_id: str, layer_id: str) -> dict:
        service = require_raster_service()
        metadata = invoke_raster(service.layer_metadata, region_id, layer_id)
        return {
            **metadata,
            "metadata_url": f"/api/data/regions/{region_id}/layers/{layer_id}/metadata",
            "raster_url": f"/api/data/regions/{region_id}/layers/{layer_id}/raster",
            "preview_url": f"/api/data/regions/{region_id}/layers/{layer_id}/preview.png",
            "tile_url_template": (
                f"/api/data/regions/{region_id}/layers/{layer_id}/tiles/{{z}}/{{x}}/{{y}}.png"
            ),
            "tile_scheme": "local_native_xyz",
            "tile_size": 256,
            "min_zoom": 0,
            "max_zoom": 12,
        }

    @domain_router.get("/regions/{region_id}/layers/{layer_id}/raster")
    def raster_bytes(region_id: str, layer_id: str):
        service = require_raster_service()
        path = invoke_raster(service.layer_path, region_id, layer_id)
        return FileResponse(
            path,
            media_type="image/tiff",
            headers={
                "Content-Disposition": f'inline; filename="{path.name}"',
                "Cache-Control": "public, max-age=3600",
            },
        )

    @domain_router.get("/regions/{region_id}/layers/{layer_id}/preview.png")
    def raster_preview(region_id: str, layer_id: str):
        service = require_raster_service()
        content = invoke_raster(service.read_preview_png, region_id, layer_id)
        return Response(
            content=content,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"},
        )

    @domain_router.get("/regions/{region_id}/layers/{layer_id}/tiles/{zoom}/{column}/{row}.png")
    def raster_tile(region_id: str, layer_id: str, zoom: int, column: int, row: int):
        service = require_raster_service()
        try:
            content = service.read_tile_png(
                region_id, layer_id, zoom, column, row
            )
        except LayerNotFound:
            raise HTTPException(
                404,
                detail={
                    "code": "LAYER_NOT_FOUND",
                    "message": "The requested raster layer is not available for this region.",
                    "details": {"region_id": region_id, "layer_id": layer_id},
                },
            )
        except KeyError:
            raise HTTPException(
                404,
                detail={"code": "REGION_NOT_FOUND", "message": "Unknown region", "details": {}},
            )
        except FileNotFoundError:
            raise HTTPException(
                503,
                detail={"code": "RASTER_UNAVAILABLE", "message": "Raster unavailable", "details": {}},
            )
        except ValueError as error:
            raise HTTPException(
                422,
                detail={
                    "code": "INVALID_TILE",
                    "message": str(error),
                    "details": {"zoom": zoom, "column": column, "row": row},
                },
            )

        return Response(
            content=content,
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=3600",
                "X-ARES-Coordinate-System": "native_projected_mars",
                "X-ARES-Tile-Scheme": "local_native_xyz",
            },
        )

    return domain_router


router = create_router()
