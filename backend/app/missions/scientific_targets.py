"""Documented scientific-target catalog used by mission planning.

The initial catalog deliberately contains a contextual entry without a grid
coordinate. A source footprint is not a verified navigation target, so the
API exposes it as non-navigable instead of inventing a destination cell.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ScientificTarget:
    target_id: str
    name: str
    region_id: str
    position: tuple[int, int] | None
    coordinate_status: str
    is_navigable: bool
    mission: str
    instrument: str
    source_url: str
    source_ids: tuple[str, ...]
    description: str


class ScientificTargetCatalog:
    """Load a small local catalog without network access."""

    def __init__(
        self,
        path: str | Path | None = None,
        *,
        targets: tuple[ScientificTarget, ...] | None = None,
    ) -> None:
        if targets is not None:
            self._targets = targets
            return
        if path is None or not Path(path).is_file():
            self._targets = ()
            return
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        self._targets = tuple(self._from_mapping(item) for item in payload.get("targets", []))

    @staticmethod
    def _from_mapping(item: dict[str, Any]) -> ScientificTarget:
        raw_position = item.get("position")
        position = None
        if raw_position is not None:
            if not isinstance(raw_position, dict):
                raise ValueError("Scientific target position must be an object or null")
            position = (int(raw_position["row"]), int(raw_position["col"]))
        status = str(item.get("coordinate_status", "contextual_only"))
        if status not in {"verified", "contextual_only"}:
            raise ValueError("Unknown scientific target coordinate status")
        return ScientificTarget(
            target_id=str(item["target_id"]),
            name=str(item["name"]),
            region_id=str(item["region_id"]),
            position=position,
            coordinate_status=status,
            is_navigable=bool(item.get("is_navigable", False)),
            mission=str(item["mission"]),
            instrument=str(item["instrument"]),
            source_url=str(item["source_url"]),
            source_ids=tuple(str(value) for value in item.get("source_ids", [])),
            description=str(item["description"]),
        )

    def for_region(self, region_id: str) -> tuple[ScientificTarget, ...]:
        return tuple(target for target in self._targets if target.region_id == region_id)

    def get(self, target_id: str, *, region_id: str | None = None) -> ScientificTarget | None:
        for target in self._targets:
            if target.target_id == target_id and (
                region_id is None or target.region_id == region_id
            ):
                return target
        return None

    @property
    def targets(self) -> tuple[ScientificTarget, ...]:
        return self._targets


def get_scientific_targets(
    region_id: str,
    *,
    catalog: ScientificTargetCatalog | None = None,
) -> tuple[ScientificTarget, ...]:
    """Return documented targets for a region; never queries a remote service."""

    return (catalog or ScientificTargetCatalog()).for_region(region_id)


__all__ = ["ScientificTarget", "ScientificTargetCatalog", "get_scientific_targets"]
