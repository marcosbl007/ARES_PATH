"""Verified Mars Trek basemap descriptors.

These records describe remote visual WMTS services only. They are not used by
the terrain loader, do not provide elevation values, and are not treated as
aligned with the local Jezero DTM automatically.
"""

from __future__ import annotations

from copy import deepcopy


_VERIFIED_LAYERS: tuple[dict[str, object], ...] = (
    {
        "layer_id": "JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0",
        "title": "MRO CTX, Jezero Mosaic, Controlled",
        "mission": "Mars Reconnaissance Orbiter",
        "instrument": "CTX",
        "item_uuid": "32003f69-a6f6-4441-bb46-4c46689c42eb",
        "wmts_endpoint": "https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0",
        "capabilities_url": "https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/WMTSCapabilities.xml",
        "tile_url_template": "https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png",
        "style": "default",
        "tile_matrix_set": "default028mm",
        "format": "image/png",
        "wmts_crs": "urn:ogc:def:crs:EPSG::104905",
        "coverage_bbox": [77.1604655, 18.2110274, 77.6991776, 18.7211945],
        "coverage_bbox_coordinate_system": "planetocentric_lon_lat_degrees",
        "max_zoom": 13,
        "source_url": "https://trek.nasa.gov/mars/",
        "verification": "GetCapabilities returned HTTP 200 with image/png and default028mm.",
        "verified_on": "2026-11-14",
        "local_alignment": "not_verified_against_jezero_fan_256",
    },
    {
        "layer_id": "JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd",
        "title": "MRO HiRISE, Jezero Mosaic, Controlled",
        "mission": "Mars Reconnaissance Orbiter",
        "instrument": "HiRISE",
        "item_uuid": "ad8d2800-e66e-4f4b-9a85-d377164d3a4e",
        "wmts_endpoint": "https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd",
        "capabilities_url": "https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/WMTSCapabilities.xml",
        "tile_url_template": "https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png",
        "style": "default",
        "tile_matrix_set": "default028mm",
        "format": "image/png",
        "wmts_crs": "urn:ogc:def:crs:EPSG::104905",
        "coverage_bbox": [77.2229331, 18.3067994, 77.583964, 18.669315],
        "coverage_bbox_coordinate_system": "planetocentric_lon_lat_degrees",
        "max_zoom": 17,
        "source_url": "https://trek.nasa.gov/mars/",
        "verification": "GetCapabilities returned HTTP 200 with image/png and default028mm.",
        "verified_on": "2026-11-14",
        "local_alignment": "not_verified_against_jezero_fan_256",
    },
)


def get_verified_mars_trek_layers() -> list[dict[str, object]]:
    """Return JSON-safe copies so callers cannot mutate the registry."""

    layers: list[dict[str, object]] = []
    for original in _VERIFIED_LAYERS:
        layer = deepcopy(original)
        layer.update(
            {
                "name": layer["title"],
                "data_type": "optical_imagery",
                "spatial_resolution_m": 0.25 if layer["instrument"] == "HiRISE" else 6.0,
                "coverage_status": "regional_remote_catalog",
                "coverage_description": "Remote Mars Trek mosaic coverage reported by its WMTS descriptor.",
                "source_urls": [layer["source_url"], layer["capabilities_url"]],
                "attribution": "NASA Mars Trek / USGS / JPL",
                "limitations": [
                    "Remote visual context only; the WMTS image does not supply elevation values.",
                    "Alignment with the local processed Jezero DTM is not verified by this catalog entry.",
                ],
                "used_for_routing": False,
                "routing_role": "display_only",
            }
        )
        layers.append(layer)
    return layers


__all__ = ["get_verified_mars_trek_layers"]
