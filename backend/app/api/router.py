"""Composition point for the public ``/api`` surface.

P4 owns this router. Domain owners can add their routes here or expose a
module-level ``APIRouter`` and register it with ``register_router``. The
router intentionally contains no NASA, terrain or A* implementation.
"""

from __future__ import annotations

from collections.abc import Iterable

from fastapi import APIRouter


router = APIRouter(prefix="/api")
"""Root router for every version-one HTTP endpoint."""

# Alias kept for integrations that conventionally import ``api_router``.
api_router = router


def register_router(domain_router: APIRouter) -> APIRouter:
    """Register a domain router under the shared ``/api`` prefix.

    Domain routers should use relative prefixes such as ``/data``,
    ``/terrain``, ``/routes``, ``/missions`` or ``/system``. Keeping the
    prefix in this composition layer prevents accidental public paths such as
    ``/api/api/...``.
    """

    router.include_router(domain_router)
    return domain_router


def register_routers(domain_routers: Iterable[APIRouter]) -> None:
    """Register several routers while a feature branch is being integrated."""

    for domain_router in domain_routers:
        register_router(domain_router)


__all__ = ["api_router", "register_router", "register_routers", "router"]

