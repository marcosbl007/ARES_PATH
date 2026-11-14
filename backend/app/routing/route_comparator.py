"""Comparison of the two route alternatives under declared criteria."""

from __future__ import annotations

from app.routing.schemas import RouteComparison, RouteResult


def compare_routes(
    shortest: RouteResult,
    terrain_aware: RouteResult,
    *,
    cost_comparable: bool = False,
) -> RouteComparison:
    """Compare routes using comparable physical metrics.

    Cost is not treated as a common unit unless both modes use the same
    objective. The comparison never turns topographic values into a safety
    score or a recommendation.
    """

    if shortest.mode != "shortest" or terrain_aware.mode != "terrain_aware":
        raise ValueError("compare_routes expects shortest first and terrain_aware second.")

    distance_delta = terrain_aware.metrics.distance_m - shortest.metrics.distance_m
    ascent_delta = terrain_aware.metrics.ascent_m - shortest.metrics.ascent_m
    descent_delta = terrain_aware.metrics.descent_m - shortest.metrics.descent_m
    slope_delta = terrain_aware.metrics.max_slope_deg - shortest.metrics.max_slope_deg
    cell_delta = terrain_aware.metrics.cell_count - shortest.metrics.cell_count
    same_path = shortest.grid_path == terrain_aware.grid_path

    notes: list[str] = []
    if same_path:
        notes.append("Both modes returned the same grid path for this request.")
    else:
        if abs(distance_delta) > 1e-9:
            relation = "longer" if distance_delta > 0.0 else "shorter"
            notes.append(
                f"terrain_aware is {abs(distance_delta):.3f} m {relation} than shortest."
            )
        if abs(ascent_delta) > 1e-9 or abs(descent_delta) > 1e-9:
            notes.append(
                "terrain_aware changes accumulated ascent by "
                f"{ascent_delta:.3f} m and descent by {descent_delta:.3f} m."
            )
        if abs(slope_delta) > 1e-9:
            relation = "reduces" if slope_delta < 0.0 else "increases"
            notes.append(
                f"terrain_aware {relation} the maximum sampled segment slope "
                f"by {abs(slope_delta):.3f} degrees."
            )

    if not cost_comparable:
        notes.append(
            "Costs are not directly comparable: shortest uses unit multipliers "
            "while terrain_aware applies the slope-based multiplier."
        )

    return RouteComparison(
        shortest=shortest,
        terrain_aware=terrain_aware,
        distance_delta_m=float(distance_delta),
        ascent_delta_m=float(ascent_delta),
        descent_delta_m=float(descent_delta),
        max_slope_delta_deg=float(slope_delta),
        cell_count_delta=int(cell_delta),
        same_path=same_path,
        cost_comparable=bool(cost_comparable),
        notes=tuple(notes),
    )


__all__ = ["compare_routes"]
