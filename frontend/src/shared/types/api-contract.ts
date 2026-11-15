import { z } from "zod";

const finiteNumber = z.number().finite();

export const GridPointSchema = z
  .object({
    row: z.number().int().nonnegative(),
    col: z.number().int().nonnegative(),
  })
  .strict();

export const TerrainConfigSchema = z
  .object({
    max_slope_deg: finiteNumber.positive().max(90),
    slope_weight: finiteNumber.min(0),
  })
  .strict();

export const MissionRequestSchema = z
  .object({
    region_id: z.string().min(1),
    coordinate_system: z.literal("grid_row_col"),
    start: GridPointSchema,
    destination: GridPointSchema,
    mode: z.literal("compare"),
    terrain_config: TerrainConfigSchema,
    scientific_target_ids: z.array(z.string().min(1)).max(16),
  })
  .strict();

export const RouteMetricsSchema = z
  .object({
    distance_m: finiteNumber.min(0),
    ascent_m: finiteNumber.min(0),
    descent_m: finiteNumber.min(0),
    max_slope_deg: finiteNumber.min(0),
    cost: finiteNumber.min(0),
    cell_count: z.number().int().min(1),
  })
  .strict();

export const RouteResponseSchema = z
  .object({
    route_id: z.string().min(1),
    mode: z.enum(["shortest", "terrain_aware"]),
    grid_path: z.array(GridPointSchema).min(1),
    metrics: RouteMetricsSchema,
    expanded_cells: z.number().int().nonnegative(),
    coordinate_system: z.literal("grid_row_col"),
  })
  .strict();

export const RouteComparisonSchema = z
  .object({
    distance_delta_m: finiteNumber,
    ascent_delta_m: finiteNumber,
    descent_delta_m: finiteNumber,
    max_slope_delta_deg: finiteNumber,
    cell_count_delta: z.number().int(),
    same_path: z.boolean(),
    cost_comparable: z.boolean(),
    notes: z.array(z.string()),
  })
  .strict();

export const ScientificTargetSchema = z
  .object({
    target_id: z.string().min(1),
    name: z.string().min(1),
    region_id: z.string().min(1),
    position: GridPointSchema.nullable(),
    coordinate_status: z.enum(["verified", "contextual_only"]),
    is_navigable: z.boolean(),
    mission: z.string().min(1),
    instrument: z.string().min(1),
    source_url: z.string().url(),
    source_ids: z.array(z.string()),
    description: z.string(),
  })
  .strict();

export const MissionResponseSchema = z
  .object({
    mission_id: z.string().min(1),
    region_id: z.string().min(1),
    coordinate_system: z.literal("grid_row_col"),
    routes: z.array(RouteResponseSchema).min(1),
    comparison: RouteComparisonSchema.nullable(),
    scientific_targets: z.array(ScientificTargetSchema),
    data_sources: z.array(z.string()),
    methodology_version: z.string().min(1),
    limitations: z.array(z.string()),
  })
  .strict();

export const HealthResponseSchema = z.object({ status: z.literal("ok") }).strict();

export const SystemInfoResponseSchema = z
  .object({
    project: z.string().min(1),
    version: z.string().min(1),
    challenge: z.string().min(1),
    scope: z.string().min(1),
    status: z.literal("prototype"),
    warning: z.string().min(1),
  })
  .strict();

export const RegionMetadataSchema = z
  .object({
    region_id: z.string().min(1),
    shape: z.tuple([z.number().int().positive(), z.number().int().positive()]),
    transform: z.array(finiteNumber).length(6),
    crs_wkt: z.string().min(1),
    pixel_size_x_m: finiteNumber.positive(),
    pixel_size_y_m: finiteNumber.positive(),
    source_ids: z.array(z.string()),
    valid_cells: z.number().int().nonnegative(),
    processed_sha256: z.string().min(1),
    map_bounds: z.array(finiteNumber).length(4).optional(),
  })
  .passthrough();

export const LayerSchema = z
  .object({
    layer_id: z.string().min(1),
    units: z.string().min(1),
    type: z.string().min(1),
    source_ids: z.array(z.string()),
    used_for_routing: z.boolean(),
    alignment_status: z.string().optional(),
    shape: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
    transform: z.array(finiteNumber).length(6).optional(),
    crs_wkt: z.string().min(1).optional(),
    map_bounds: z.array(finiteNumber).length(4).optional(),
    coordinate_system: z.string().min(1).optional(),
    metadata_url: z.string().min(1).optional(),
    raster_url: z.string().min(1).optional(),
    preview_url: z.string().min(1).optional(),
    tile_url_template: z.string().min(1).optional(),
    tile_scheme: z.string().min(1).optional(),
    tile_size: z.number().int().positive().optional(),
    min_zoom: z.number().int().nonnegative().optional(),
    max_zoom: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const ElevationProfileResponseSchema = z
  .object({
    grid_path: z.array(GridPointSchema).min(1),
    cumulative_distance_m: z.array(finiteNumber),
    elevation_m: z.array(finiteNumber),
    distance_m: finiteNumber.min(0),
    ascent_m: finiteNumber.min(0),
    descent_m: finiteNumber.min(0),
    max_slope_deg: finiteNumber.min(0),
  })
  .strict();

export type GridPoint = z.infer<typeof GridPointSchema>;
export type TerrainConfig = z.infer<typeof TerrainConfigSchema>;
export type MissionRequest = z.infer<typeof MissionRequestSchema>;
export type RouteMetrics = z.infer<typeof RouteMetricsSchema>;
export type RouteResponse = z.infer<typeof RouteResponseSchema>;
export type RouteComparison = z.infer<typeof RouteComparisonSchema>;
export type ScientificTarget = z.infer<typeof ScientificTargetSchema>;
export type MissionResponse = z.infer<typeof MissionResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type SystemInfoResponse = z.infer<typeof SystemInfoResponseSchema>;
export type RegionMetadata = z.infer<typeof RegionMetadataSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type ElevationProfileResponse = z.infer<typeof ElevationProfileResponseSchema>;
