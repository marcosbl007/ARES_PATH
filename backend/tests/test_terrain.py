"""Deterministic terrain checks using synthetic elevations, never NASA observations."""

from dataclasses import dataclass

import numpy as np
import pytest

from app.terrain import (
    TerrainAnalyzer,
    TerrainConfig,
    analyze_region,
    calculate_elevation_profile,
    calculate_slope,
    generate_terrain_cost_grid,
    get_terrain_statistics,
)


@dataclass(frozen=True)
class SyntheticRegion:
    region_id: str
    elevation_m: np.ndarray
    valid_mask: np.ndarray
    pixel_size_x_m: float
    pixel_size_y_m: float


def region(
    elevation: list[list[float]] | np.ndarray,
    *,
    pixel_x: float = 1.0,
    pixel_y: float = 1.0,
    valid_mask: np.ndarray | None = None,
) -> SyntheticRegion:
    values = np.asarray(elevation, dtype=np.float64)
    mask = np.isfinite(values) if valid_mask is None else valid_mask
    return SyntheticRegion("synthetic", values, mask, pixel_x, pixel_y)


def test_flat_terrain_has_zero_slope_and_unit_cost() -> None:
    sample = region(np.full((3, 3), 100.0))
    terrain = generate_terrain_cost_grid(sample)

    np.testing.assert_allclose(calculate_slope(sample), 0.0)
    assert terrain.slope_deg.shape == (3, 3)
    assert terrain.traversable.all()
    np.testing.assert_allclose(terrain.cost_multiplier, 1.0)


@pytest.mark.parametrize("axis", [0, 1])
def test_one_to_one_ramp_is_45_degrees_on_either_axis(axis: int) -> None:
    coordinates = np.indices((5, 5))[axis].astype(np.float64)
    sample = region(coordinates)

    np.testing.assert_allclose(calculate_slope(sample), 45.0, atol=1e-12)


def test_rectangular_pixels_use_the_correct_axis_spacing() -> None:
    rows, cols = np.indices((3, 3))
    sample = region(5.0 * rows + 2.0 * cols, pixel_x=2.0, pixel_y=5.0)

    np.testing.assert_allclose(
        calculate_slope(sample), np.degrees(np.arctan(np.sqrt(2.0))), atol=1e-12
    )


def test_nodata_blocks_cell_and_nearby_unsupported_slopes() -> None:
    values = np.zeros((5, 5), dtype=np.float64)
    values[2, 2] = np.nan
    sample = region(values)
    terrain = generate_terrain_cost_grid(sample)

    for row, col in ((2, 2), (1, 2), (3, 2), (2, 1), (2, 3)):
        assert np.isnan(terrain.slope_deg[row, col])
        assert not terrain.traversable[row, col]
        assert np.isnan(terrain.cost_multiplier[row, col])
    assert terrain.traversable[0, 0]


def test_slope_threshold_includes_equal_value_and_cost_is_configurable() -> None:
    sample = region(np.tile(np.arange(3, dtype=np.float64), (3, 1)))
    accepted = generate_terrain_cost_grid(
        sample, {"max_slope_deg": 45.0, "slope_weight": 2.0}
    )
    rejected = generate_terrain_cost_grid(
        sample, {"max_slope_deg": 44.0, "slope_weight": 2.0}
    )

    assert accepted.traversable.all()
    np.testing.assert_allclose(accepted.cost_multiplier, 3.0)
    assert not rejected.traversable.any()
    assert np.isnan(rejected.cost_multiplier).all()


def test_elevation_profile_reports_physical_distance_and_relief() -> None:
    sample = region([[10, 15, 12, 20], [10, 15, 12, 20]], pixel_x=2.0)
    profile = calculate_elevation_profile(sample, [(0, 0), (0, 1), (0, 2), (0, 3)])

    assert profile.elevation_m == (10.0, 15.0, 12.0, 20.0)
    assert profile.cumulative_distance_m == (0.0, 2.0, 4.0, 6.0)
    assert profile.distance_m == 6.0
    assert profile.ascent_m == 13.0
    assert profile.descent_m == 3.0
    assert profile.max_slope_deg == pytest.approx(np.degrees(np.arctan2(8, 2)))


def test_single_point_profile_and_invalid_paths() -> None:
    sample = region([[10, np.nan, 12], [10, 11, 12], [10, 11, 12]])
    profile = calculate_elevation_profile(sample, [{"row": 0, "col": 0}])
    assert (profile.distance_m, profile.ascent_m, profile.descent_m, profile.max_slope_deg) == (
        0.0, 0.0, 0.0, 0.0
    )

    for path in (
        [],
        [(0, 0), (0, 0)],
        [(0, 0), (2, 2)],
        [(0, 0), (0, 1)],
        [(0, 0), (3, 0)],
    ):
        with pytest.raises(ValueError):
            calculate_elevation_profile(sample, path)


def test_summary_and_facade_share_the_same_configuration() -> None:
    sample = region(np.full((3, 3), 100.0), pixel_x=2.0, pixel_y=5.0)
    analyzer = TerrainAnalyzer(TerrainConfig(max_slope_deg=10.0, slope_weight=3.0))
    summary = get_terrain_statistics(sample, analyzer.config)

    assert summary.region_id == "synthetic"
    assert summary.valid_cell_count == 9
    assert summary.traversable_cell_count == 9
    assert summary.elevation_mean_m == 100.0
    assert summary.slope_max_deg == 0.0
    assert (summary.pixel_size_x_m, summary.pixel_size_y_m) == (2.0, 5.0)
    assert analyzer.summary(sample) == summary
    assert analyzer.analyze(sample).traversable.all()
    assert analyze_region(sample, analyzer.config).config == analyzer.analyze(sample).config


def test_person_one_region_data_contract_flows_into_terrain() -> None:
    from affine import Affine

    from app.nasa_data.schemas import RegionData

    elevations = np.tile(np.arange(3, dtype=np.float64), (3, 1))
    prepared = RegionData(
        region_id="synthetic",
        elevation_m=elevations,
        valid_mask=np.ones((3, 3), dtype=bool),
        transform=Affine(1, 0, 0, 0, -1, 0),
        crs_wkt="MARS_SYNTHETIC_METRIC",
        pixel_size_x_m=1.0,
        pixel_size_y_m=1.0,
        source_ids=("synthetic",),
    )

    terrain = analyze_region(prepared, {"max_slope_deg": 45.0, "slope_weight": 2.0})
    assert terrain.slope_deg.shape == prepared.elevation_m.shape
    assert terrain.traversable.all()
    np.testing.assert_allclose(terrain.slope_deg, 45.0)
    np.testing.assert_allclose(terrain.cost_multiplier, 3.0)


@pytest.mark.parametrize(
    "config",
    [
        {"max_slope_deg": 0.0},
        {"max_slope_deg": 91.0},
        {"slope_weight": -1.0},
        {"slope_weight": float("nan")},
        {"unrecognized": 1.0},
    ],
)
def test_invalid_terrain_parameters_are_rejected(config: dict[str, float]) -> None:
    with pytest.raises(ValueError):
        TerrainConfig.from_value(config)


def test_unknown_or_inconsistent_metric_inputs_are_rejected() -> None:
    with pytest.raises(ValueError, match="pixel sizes"):
        calculate_slope(region(np.zeros((3, 3)), pixel_x=0.0))
    with pytest.raises(ValueError, match="finite"):
        calculate_slope(
            region(np.full((3, 3), np.nan), valid_mask=np.ones((3, 3), dtype=bool))
        )
