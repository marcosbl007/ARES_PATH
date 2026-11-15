# Raster serving and map layers

The backend serves the validated local assets for `jezero_fan_256` through
the NASA data router. The source data remains local and reproducible; the API
does not download a remote raster while serving a request.

## Local assets

For `elevation` and `orthoimage` layers:

- `GET /api/data/regions/{region_id}/layers/{layer_id}/metadata` returns the
  source shape, affine transform, CRS WKT, map bounds, units, hashes from the
  sidecar and resource URLs.
- `GET /api/data/regions/{region_id}/layers/{layer_id}/raster` returns the
  processed GeoTIFF bytes. Elevation values remain numeric and are not
  colorized.
- `GET /api/data/regions/{region_id}/layers/{layer_id}/preview.png` returns a
  display-only RGBA PNG for the complete local raster extent.
- `GET /api/data/regions/{region_id}/layers/{layer_id}/tiles/{z}/{x}/{y}.png`
  returns display-only RGBA tiles.

The local tile matrix is `local_native_xyz`: zoom 0 is one tile covering the
entire local raster bounds, and each zoom subdivides that same extent into
`2^z x 2^z` tiles. The matrix uses the GeoTIFF's native projected Mars CRS;
it does not use Web Mercator or terrestrial assumptions. Tile PNGs are never
fed into slope, elevation or route calculations.

The service verifies the region identifier, GeoTIFF checksum, sidecar
provenance and the orthoimage/DTM grid alignment before serving bytes. NoData
pixels become transparent in previews and tiles. Elevation PNGs use a
display-only percentile stretch; the original elevation remains available
only through the GeoTIFF and terrain services.

## NASA Mars Trek descriptors

`GET /api/data/mars-trek/layers` returns verified descriptors for the Jezero
CTX and HiRISE WMTS layers. The records include the official GetCapabilities
URL, `default028mm` matrix set, `image/png` format, coverage bounds and the
Mars Trek CRS identifier. The descriptors are configuration/provenance only;
the backend does not proxy those remote tiles and does not claim that their
CRS is aligned with the local `jezero_fan_256` DTM.

The local DTM uses its own equirectangular Mars WKT with a documented sphere
radius and standard parallel. Any future overlay with Mars Trek must define an
explicit reprojection and validate control points before being presented as
aligned.
