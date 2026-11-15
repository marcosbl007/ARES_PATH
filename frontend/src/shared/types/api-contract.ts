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

export const AnalysisWindowSchema = z
  .object({
    row: z.number().int().nonnegative(),
    col: z.number().int().nonnegative(),
    height: z.number().int().positive(),
    width: z.number().int().positive(),
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
    analysis_window: AnalysisWindowSchema.nullable().optional(),
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

export const ScientificSourceReferenceSchema = z
  .object({
    mission: z.string().nullable().optional(),
    instrument: z.string().nullable().optional(),
    dataset: z.string().nullable().optional(),
    title: z.string().min(1),
    url: z.string().url(),
  })
  .strict();

export const ScientificTargetLocationSchema = z
  .object({
    latitude: finiteNumber.nullable().optional(),
    longitude: finiteNumber.nullable().optional(),
    projected_x: finiteNumber.nullable().optional(),
    projected_y: finiteNumber.nullable().optional(),
    crs: z.string().nullable().optional(),
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
    target_type: z.enum([
      "geological_formation",
      "sedimentary_feature",
      "mineralogical_interest",
      "sample_site",
      "observation_site",
      "user_defined",
    ]),
    scientific_objective: z.string(),
    scientific_importance: z.string().nullable().optional(),
    location: ScientificTargetLocationSchema.nullable().optional(),
    geometry_type: z.enum(["point", "polygon"]),
    evidence_status: z.enum(["verified", "derived", "user_defined", "unverified"]),
    source_references: z.array(ScientificSourceReferenceSchema),
    spatial_resolution_m: finiteNumber.positive().nullable().optional(),
    limitations: z.array(z.string()),
    routable: z.boolean(),
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
    routing_role: z.enum(["input", "derived_input", "display_only"]).optional(),
    name: z.string().optional(),
    data_type: z.string().optional(),
    mission: z.string().nullable().optional(),
    instrument: z.string().nullable().optional(),
    spatial_resolution_m: finiteNumber.positive().optional(),
    coverage_status: z.string().optional(),
    coverage_description: z.string().optional(),
    source_urls: z.array(z.string().url()).optional(),
    attribution: z.string().nullable().optional(),
    derived_from: z.string().optional(),
    derivation_method: z.string().optional(),
    limitations: z.array(z.string()).optional(),
    alignment_status: z.string().optional(),
    shape: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
    transform: z.array(finiteNumber).length(6).optional(),
    crs_wkt: z.string().min(1).optional(),
    map_bounds: z.array(finiteNumber).length(4).optional(),
    coordinate_system: z.string().min(1).optional(),
    metadata_url: z.string().min(1).optional(),
    raster_url: z.string().min(1).optional(),
    preview_url: z.string().min(1).optional(),
    cached_preview_data_url: z.string().startsWith("data:image/").optional(),
    tile_url_template: z.string().min(1).optional(),
    tile_scheme: z.string().min(1).optional(),
    tile_size: z.number().int().positive().optional(),
    min_zoom: z.number().int().nonnegative().optional(),
    max_zoom: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const MarsTrekLayerSchema = z
  .object({
    layer_id: z.string().min(1),
    title: z.string().min(1),
    mission: z.string().min(1),
    instrument: z.string().min(1),
    item_uuid: z.string().min(1),
    wmts_endpoint: z.string().url(),
    capabilities_url: z.string().url(),
    tile_url_template: z.string().url(),
    style: z.string().min(1),
    tile_matrix_set: z.string().min(1),
    format: z.string().min(1),
    wmts_crs: z.string().min(1),
    coverage_bbox: z.array(finiteNumber).length(4),
    coverage_bbox_coordinate_system: z.string().min(1),
    max_zoom: z.number().int().nonnegative(),
    source_url: z.string().url(),
    verification: z.string().min(1),
    verified_on: z.string().min(1),
    local_alignment: z.string().min(1),
    name: z.string().optional(),
    data_type: z.string().optional(),
    spatial_resolution_m: finiteNumber.positive().optional(),
    coverage_status: z.string().optional(),
    coverage_description: z.string().optional(),
    source_urls: z.array(z.string().url()).optional(),
    attribution: z.string().optional(),
    limitations: z.array(z.string()).optional(),
    used_for_routing: z.boolean().optional(),
    routing_role: z.enum(["input", "derived_input", "display_only"]).optional(),
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

export const MissionOverviewSchema = z
  .object({
    mission_id: z.string().min(1),
    region_id: z.string().min(1),
    generated_at_utc: z.string().min(1),
    coordinate_system: z.literal("grid_row_col"),
    origin: GridPointSchema,
    destination: GridPointSchema,
    objective: z.string().min(1),
    planning_status: z.enum(["calculated", "partial"]),
  })
  .strict();

export const ScientificObjectiveBriefingSchema = z
  .object({
    target_id: z.string().nullable(),
    name: z.string().min(1),
    description: z.string(),
    scientific_importance: z.string().nullable().optional(),
    evidence_status: z.enum(["verified", "derived", "user_defined", "unverified"]),
    source_references: z.array(ScientificSourceReferenceSchema),
    limitations: z.array(z.string()),
  })
  .strict();

export const TerrainAssessmentSchema = z
  .object({
    coverage_status: z.enum(["complete", "partial"]),
    valid_cell_count: z.number().int().nonnegative(),
    nodata_cell_count: z.number().int().nonnegative(),
    resolution_x_m: finiteNumber.positive(),
    resolution_y_m: finiteNumber.positive(),
    vertical_datum: z.string().nullable().optional(),
    elevation_start_m: finiteNumber.nullable().optional(),
    elevation_destination_m: finiteNumber.nullable().optional(),
    maximum_route_slope_deg: finiteNumber.min(0),
    slope_threshold_deg: finiteNumber.positive().max(90),
    slope_weight: finiteNumber.min(0),
    traversable_cell_count: z.number().int().nonnegative(),
    non_traversable_cell_count: z.number().int().nonnegative(),
    slope_method: z.string().min(1),
    restrictions: z.array(z.string()),
  })
  .strict();

export const RouteBriefingSchema = z
  .object({
    route_id: z.string().min(1),
    mode: z.enum(["shortest", "terrain_aware"]),
    metrics: RouteMetricsSchema,
    elevation_profile: ElevationProfileResponseSchema,
    restrictions: z.array(z.string()),
  })
  .strict();

export const RouteTradeoffSchema = z
  .object({
    statement: z.string().min(1),
    evidence: z.array(z.string()),
  })
  .strict();

export const DataProvenanceSchema = z
  .object({
    source_id: z.string().min(1),
    role: z.enum(["map_visual", "dem", "scientific_objective", "algorithm"]),
    title: z.string().min(1),
    mission: z.string().nullable().optional(),
    instrument: z.string().nullable().optional(),
    dataset: z.string().nullable().optional(),
    url: z.string().url().nullable().optional(),
    processing: z.string().nullable().optional(),
    limitations: z.array(z.string()),
  })
  .strict();

export const MissionBriefingSchema = z
  .object({
    mission_overview: MissionOverviewSchema,
    scientific_objectives: z.array(ScientificObjectiveBriefingSchema),
    terrain_assessment: TerrainAssessmentSchema,
    route_comparison: z.array(RouteBriefingSchema).min(1),
    route_tradeoffs: z.array(RouteTradeoffSchema),
    data_provenance: z.array(DataProvenanceSchema),
    limitations: z.array(z.string()),
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
    briefing: MissionBriefingSchema.nullable().optional(),
    analysis_window: AnalysisWindowSchema.nullable().optional(),
  })
  .strict();

export const TerrainSampleResponseSchema = z
  .object({
    region_id: z.string().min(1),
    point: GridPointSchema,
    coordinate_system: z.literal("grid_row_col"),
    map_x_m: finiteNumber,
    map_y_m: finiteNumber,
    coverage_status: z.enum(["valid", "nodata", "outside"]),
    no_data: z.boolean(),
    elevation_m: finiteNumber.nullable().optional(),
    slope_deg: finiteNumber.nullable().optional(),
    slope_exceeds_threshold: z.boolean().nullable().optional(),
    traversable: z.boolean().nullable().optional(),
    elevation_units: z.literal("m"),
    slope_units: z.literal("degrees"),
    pixel_size_x_m: finiteNumber.positive(),
    pixel_size_y_m: finiteNumber.positive(),
    source_ids: z.array(z.string()),
    available_layer_ids: z.array(z.string()),
    nearby_scientific_targets: z.array(ScientificTargetSchema),
    limitations: z.array(z.string()),
  })
  .strict();

export type GridPoint = z.infer<typeof GridPointSchema>;
export type TerrainConfig = z.infer<typeof TerrainConfigSchema>;
export type AnalysisWindow = z.infer<typeof AnalysisWindowSchema>;
export type MissionRequest = z.infer<typeof MissionRequestSchema>;
export type RouteMetrics = z.infer<typeof RouteMetricsSchema>;
export type RouteResponse = z.infer<typeof RouteResponseSchema>;
export type RouteComparison = z.infer<typeof RouteComparisonSchema>;
export type ScientificTarget = z.infer<typeof ScientificTargetSchema>;
export type ScientificSourceReference = z.infer<typeof ScientificSourceReferenceSchema>;
export type MissionResponse = z.infer<typeof MissionResponseSchema>;
export type MissionBriefing = z.infer<typeof MissionBriefingSchema>;
export type MissionOverview = z.infer<typeof MissionOverviewSchema>;
export type TerrainAssessment = z.infer<typeof TerrainAssessmentSchema>;
export type RouteBriefing = z.infer<typeof RouteBriefingSchema>;
export type RouteTradeoff = z.infer<typeof RouteTradeoffSchema>;
export type DataProvenance = z.infer<typeof DataProvenanceSchema>;
export type TerrainSampleResponse = z.infer<typeof TerrainSampleResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type SystemInfoResponse = z.infer<typeof SystemInfoResponseSchema>;
export type RegionMetadata = z.infer<typeof RegionMetadataSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type MarsTrekLayer = z.infer<typeof MarsTrekLayerSchema>;
export type ElevationProfileResponse = z.infer<typeof ElevationProfileResponseSchema>;
