"""Terrain analysis primitives for ARES PATH."""

from app.terrain.analyzer import (
    TerrainAnalyzer,
    analyze_region,
    calculate_elevation_profile,
    calculate_slope,
    generate_terrain_cost_grid,
    get_terrain_statistics,
)
from app.terrain.schemas import (
    ElevationProfile,
    GridPoint,
    TerrainConfig,
    TerrainData,
    TerrainStatistics,
)

__all__ = [
    "ElevationProfile",
    "GridPoint",
    "TerrainAnalyzer",
    "TerrainConfig",
    "TerrainData",
    "TerrainStatistics",
    "analyze_region",
    "calculate_elevation_profile",
    "calculate_slope",
    "generate_terrain_cost_grid",
    "get_terrain_statistics",
]
