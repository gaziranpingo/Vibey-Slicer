import * as THREE from 'three';

export interface Point2D {
  x: number;
  y: number;
}

export interface Segment2D {
  a: Point2D;
  b: Point2D;
  type: 'outer_wall' | 'inner_wall' | 'solid_infill' | 'sparse_infill' | 'skirt' | 'travel' | 'support' | 'support_interface';
}

export interface ExPolygon {
  contour: Point2D[];
  holes: Point2D[][];
  bbox?: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface SlicedLayer {
  layerIndex: number;
  z: number;
  height: number;
  expolygons: ExPolygon[];
  segments: Segment2D[];
}

export interface PrinterProfile {
  id: string;
  name: string;
  bedWidth: number;   // mm (X)
  bedDepth: number;   // mm (Y)
  maxHeight: number;  // mm (Z)
  nozzleDiameter: number;
  shape: 'rectangular' | 'circular';
  company?: string;
}

export interface MaterialProfile {
  id: string;
  name: string;
  type: 'PLA' | 'PETG' | 'ABS' | 'TPU';
  hotendTemp: number; // °C
  bedTemp: number;    // °C
  fanSpeed: number;   // %
  densityGPerCm3: number;
  costPerKg: number;  // USD
  retractionLength: number; // mm
  retractionSpeed: number;  // mm/s
}

export interface ModelTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // degrees
  scale: { x: number; y: number; z: number };     // multiplier, 1.0 = 100%
  uniformScale: boolean;
}

export interface SlicerSettings {
  // Machine & Filament
  printerId: string;
  materialId: string;
  nozzleDiameter: number;
  filamentDiameter: number;
  extrusionMultiplier: number;
  bedTemp: number;
  hotendTemp: number;
  fanSpeed: number;

  // Layer Heights
  layerHeight: number;
  firstLayerHeight: number;

  // Shells
  wallCount: number;
  wallGapDistance: number;
  topSolidLayers: number;
  bottomSolidLayers: number;
  solidInfillPattern: 'rectilinear' | 'monotonic' | 'concentric' | 'hilbert';

  // Infill
  infillDensity: number; // 0 - 100%
  infillPattern: 'grid' | 'lines' | 'triangles' | 'gyroid';

  // Speeds (mm/s)
  perimeterSpeed: number;
  infillSpeed: number;
  travelSpeed: number;
  firstLayerSpeed: number;

  // Retraction
  retractionLength: number;
  retractionSpeed: number;
  zHop: number;

  // Adhesion
  adhesionType: 'none' | 'skirt' | 'brim';
  skirtOffset: number;
  skirtLoops: number;
  brimWidth: number;

  // Supports (Regular, Tree, Minimal Surface)
  enableSupports: boolean;
  supportStyle: 'regular' | 'tree' | 'minimal_surface';
  supportOverhangAngle: number; // degrees from vertical (e.g. 50°)
  supportDensity: number;       // % density (e.g. 18%)
  supportZDistance: number;     // vertical gap from model in mm (e.g. 0.2mm)
  supportXyDistance: number;    // horizontal clearance from model in mm (e.g. 0.6mm)
}

export interface GCodeStats {
  totalLayers: number;
  totalFilamentUsedMm: number;
  totalFilamentWeightGrams: number;
  estimatedTimeSeconds: number;
  estimatedCostUsd: number;
  totalMoves: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

export interface SliceResult {
  layers: SlicedLayer[];
  gcode: string;
  stats: GCodeStats;
}

export interface LoadedModel {
  id: string;
  name: string;
  vertexCount: number;
  triangleCount: number;
  originalDimensions: { x: number; y: number; z: number };
  currentDimensions: { x: number; y: number; z: number };
  bufferGeometry: THREE.BufferGeometry;
  color: string;
  transform: ModelTransform;
}

export type AppViewMode = 'prepare' | 'preview' | 'gcode';
