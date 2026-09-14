import * as THREE from 'three';
import { PRINTER_PROFILES } from './presets';
import {
  Point2D,
  Segment2D,
  ExPolygon,
  SlicedLayer,
  SlicerSettings,
  SliceResult,
  GCodeStats
} from '../types';

interface TriangleSimple {
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  p3: THREE.Vector3;
  minZ: number;
  maxZ: number;
}

/**
 * Checks if point is inside 2D polygon (ray casting)
 */
function isPointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Calculates signed area of 2D polygon (positive = clockwise, negative = counter-clockwise)
 */
function polygonSignedArea(poly: Point2D[]): number {
  let area = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];
    area += (p2.x - p1.x) * (p2.y + p1.y);
  }
  return area / 2;
}

/**
 * Stitches disjoint 2D line segments into closed polygons using a 3x3 spatial hash
 */
function stitchSegmentsToLoops(rawSegments: { start: Point2D; end: Point2D }[]): Point2D[][] {
  if (rawSegments.length === 0) return [];

  const used = new Uint8Array(rawSegments.length);
  const loops: Point2D[][] = [];

  const bucketSize = 1.0;
  const makeKey = (gx: number, gy: number) => `${gx},${gy}`;

  const endpointMap = new Map<string, number[]>();
  for (let i = 0; i < rawSegments.length; i++) {
    const s = rawSegments[i];
    const k1 = makeKey(Math.floor(s.start.x / bucketSize), Math.floor(s.start.y / bucketSize));
    const k2 = makeKey(Math.floor(s.end.x / bucketSize), Math.floor(s.end.y / bucketSize));

    if (!endpointMap.has(k1)) endpointMap.set(k1, []);
    endpointMap.get(k1)!.push(i);

    if (!endpointMap.has(k2)) endpointMap.set(k2, []);
    endpointMap.get(k2)!.push(i);
  }

  const findNearestUnused = (pt: Point2D, maxDist: number): { segIdx: number; isStart: boolean } | null => {
    const gx = Math.floor(pt.x / bucketSize);
    const gy = Math.floor(pt.y / bucketSize);
    let bestDist = maxDist;
    let bestMatch: { segIdx: number; isStart: boolean } | null = null;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = endpointMap.get(makeKey(gx + dx, gy + dy));
        if (!bucket) continue;
        for (let b = 0; b < bucket.length; b++) {
          const idx = bucket[b];
          if (used[idx]) continue;
          const s = rawSegments[idx];
          const dS = Math.hypot(s.start.x - pt.x, s.start.y - pt.y);
          if (dS < bestDist) {
            bestDist = dS;
            bestMatch = { segIdx: idx, isStart: true };
          }
          const dE = Math.hypot(s.end.x - pt.x, s.end.y - pt.y);
          if (dE < bestDist) {
            bestDist = dE;
            bestMatch = { segIdx: idx, isStart: false };
          }
        }
      }
    }
    return bestMatch;
  };

  for (let i = 0; i < rawSegments.length; i++) {
    if (used[i]) continue;

    const currentLoop: Point2D[] = [rawSegments[i].start, rawSegments[i].end];
    used[i] = 1;

    let iterations = 0;
    const maxIterations = rawSegments.length;

    while (iterations < maxIterations) {
      iterations++;
      const lastPoint = currentLoop[currentLoop.length - 1];
      const firstPoint = currentLoop[0];
      const dFirst = Math.hypot(lastPoint.x - firstPoint.x, lastPoint.y - firstPoint.y);

      if (currentLoop.length >= 3 && dFirst < 0.15) {
        break; // Loop closed cleanly
      }

      // Try primary tight tolerance first, then fallback to looser search if needed
      let match = findNearestUnused(lastPoint, 0.15);
      if (!match) {
        match = findNearestUnused(lastPoint, 0.4);
      }
      if (!match) {
        match = findNearestUnused(lastPoint, 0.8);
      }

      if (!match) {
        if (currentLoop.length >= 3 && dFirst < 0.8) {
          break; // Gap is small enough to close
        }
        break;
      }

      used[match.segIdx] = 1;
      const seg = rawSegments[match.segIdx];
      currentLoop.push(match.isStart ? seg.end : seg.start);
    }

    if (currentLoop.length >= 3) {
      const firstPoint = currentLoop[0];
      const lastPoint = currentLoop[currentLoop.length - 1];
      const dFirst = Math.hypot(lastPoint.x - firstPoint.x, lastPoint.y - firstPoint.y);
      if (dFirst < 0.8) {
        if (dFirst > 1e-4) {
          currentLoop.push({ x: firstPoint.x, y: firstPoint.y });
        }
        const clean = simplifyPolygon(currentLoop, 0.02);
        if (clean.length >= 3) {
          if (Math.hypot(clean[clean.length - 1].x - clean[0].x, clean[clean.length - 1].y - clean[0].y) < 1e-4) {
            clean.pop();
          }
          if (clean.length >= 3 && Math.abs(polygonSignedArea(clean)) > 0.01) {
            loops.push(clean);
          }
        }
      }
    }
  }

  return loops;
}

/**
 * Polygon simplification
 */
function simplifyPolygon(pts: Point2D[], tolerance: number): Point2D[] {
  if (pts.length <= 3) return pts;
  const result: Point2D[] = [pts[0]];

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    const d = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (d < tolerance) continue;

    const cross = Math.abs((curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x));
    if (cross < 0.01) continue;

    result.push(curr);
  }

  result.push(pts[pts.length - 1]);
  return result;
}

interface LoopBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function computeBBox(poly: Point2D[]): LoopBox {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

function isBBoxInside(inner: LoopBox, outer: LoopBox): boolean {
  return (
    inner.minX >= outer.minX - 1e-3 &&
    inner.maxX <= outer.maxX + 1e-3 &&
    inner.minY >= outer.minY - 1e-3 &&
    inner.maxY <= outer.maxY + 1e-3
  );
}

function loopContainsLoop(outerPoly: Point2D[], outerBBox: LoopBox, innerPoly: Point2D[], innerBBox: LoopBox): boolean {
  if (
    innerBBox.minX < outerBBox.minX - 0.05 ||
    innerBBox.maxX > outerBBox.maxX + 0.05 ||
    innerBBox.minY < outerBBox.minY - 0.05 ||
    innerBBox.maxY > outerBBox.maxY + 0.05
  ) {
    return false;
  }

  const n = innerPoly.length;
  if (n < 3) return false;

  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    cx += innerPoly[i].x;
    cy += innerPoly[i].y;
  }
  cx /= n;
  cy /= n;

  const testPts: Point2D[] = [];
  if (isPointInPolygon({ x: cx, y: cy }, innerPoly)) {
    testPts.push({ x: cx, y: cy });
  }

  const step = Math.max(1, Math.floor(n / 8));
  for (let i = 0; i < n && testPts.length < 9; i += step) {
    const p1 = innerPoly[i];
    const p2 = innerPoly[(i + 1) % n];
    const mx = (p1.x + p2.x) * 0.5;
    const my = (p1.y + p2.y) * 0.5;
    const candidate = {
      x: mx + (cx - mx) * 0.1,
      y: my + (cy - my) * 0.1
    };
    if (isPointInPolygon(candidate, innerPoly)) {
      testPts.push(candidate);
    }
  }

  if (testPts.length === 0) {
    for (let i = 0; i < n && testPts.length < 5; i += step) {
      testPts.push({ x: innerPoly[i].x + 1e-4, y: innerPoly[i].y + 1e-4 });
    }
  }

  let insideCount = 0;
  for (const pt of testPts) {
    if (isPointInPolygon(pt, outerPoly)) {
      insideCount++;
    }
  }

  return insideCount >= Math.ceil(testPts.length * 0.5);
}

/**
 * Groups raw closed loops into ExPolygons with multi-level nesting depth
 * (even depth = outer contour, odd depth = inner cavity hole)
 */
function groupLoopsIntoExPolygons(loops: Point2D[][]): ExPolygon[] {
  if (loops.length === 0) return [];

  interface Meta {
    poly: Point2D[];
    bbox: LoopBox;
    area: number;
    absArea: number;
  }

  const metas: Meta[] = [];
  for (const loop of loops) {
    const area = polygonSignedArea(loop);
    const absArea = Math.abs(area);
    if (absArea < 0.02 || loop.length < 3) continue;
    metas.push({
      poly: loop,
      bbox: computeBBox(loop),
      area,
      absArea
    });
  }

  const N = metas.length;
  if (N === 0) return [];

  metas.sort((a, b) => b.absArea - a.absArea);

  const contains: boolean[][] = Array.from({ length: N }, () => new Array(N).fill(false));

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (metas[i].absArea > metas[j].absArea && loopContainsLoop(metas[i].poly, metas[i].bbox, metas[j].poly, metas[j].bbox)) {
        contains[i][j] = true;
      }
    }
  }

  const depth = new Int32Array(N);
  const parent = new Int32Array(N).fill(-1);

  for (let j = 0; j < N; j++) {
    let d = 0;
    let directParent = -1;
    let maxParentDepth = -1;

    for (let i = 0; i < N; i++) {
      if (contains[i][j]) {
        d++;
        if (depth[i] > maxParentDepth) {
          maxParentDepth = depth[i];
          directParent = i;
        }
      }
    }
    depth[j] = d;
    parent[j] = directParent;
  }

  const loopToExPolyIndex = new Map<number, number>();
  const expolygons: ExPolygon[] = [];

  for (let i = 0; i < N; i++) {
    if (depth[i] % 2 === 0) {
      loopToExPolyIndex.set(i, expolygons.length);
      expolygons.push({
        contour: metas[i].poly,
        holes: [],
        bbox: metas[i].bbox
      });
    }
  }

  for (let i = 0; i < N; i++) {
    if (depth[i] % 2 === 1) {
      let pIdx = parent[i];
      while (pIdx !== -1 && depth[pIdx] % 2 !== 0) {
        pIdx = parent[pIdx];
      }
      if (pIdx !== -1 && loopToExPolyIndex.has(pIdx)) {
        const expIdx = loopToExPolyIndex.get(pIdx)!;
        expolygons[expIdx].holes.push(metas[i].poly);
      }
    }
  }

  return expolygons;
}

/**
 * Offsets a polygon inward or outward
 */
function offsetPolygon(pts: Point2D[], delta: number): Point2D[] {
  const n = pts.length;
  if (n < 3) return pts;

  const result: Point2D[] = [];
  const isCW = polygonSignedArea(pts) > 0;
  const effectiveDelta = isCW ? delta : -delta;

  for (let i = 0; i < n; i++) {
    const pPrev = pts[(i - 1 + n) % n];
    const pCurr = pts[i];
    const pNext = pts[(i + 1) % n];

    const v1 = { x: pCurr.x - pPrev.x, y: pCurr.y - pPrev.y };
    const len1 = Math.hypot(v1.x, v1.y) || 1;
    v1.x /= len1; v1.y /= len1;

    const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };
    const len2 = Math.hypot(v2.x, v2.y) || 1;
    v2.x /= len2; v2.y /= len2;

    const n1 = { x: -v1.y, y: v1.x };
    const n2 = { x: -v2.y, y: v2.x };

    const bn = { x: (n1.x + n2.x) * 0.5, y: (n1.y + n2.y) * 0.5 };
    const blen = Math.hypot(bn.x, bn.y) || 1;
    bn.x /= blen; bn.y /= blen;

    const sinHalfAngle = Math.max(0.2, n1.x * bn.x + n1.y * bn.y);
    const miterDist = Math.min(Math.abs(effectiveDelta) * 2.5, Math.abs(effectiveDelta) / sinHalfAngle);
    const sign = effectiveDelta >= 0 ? 1 : -1;

    result.push({
      x: pCurr.x + bn.x * miterDist * sign,
      y: pCurr.y + bn.y * miterDist * sign
    });
  }

  return result;
}

/**
 * Converts a polygon loop to printable line segments
 */
function polygonToSegments(pts: Point2D[], type: Segment2D['type']): Segment2D[] {
  const segs: Segment2D[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    segs.push({
      a: pts[i],
      b: pts[(i + 1) % n],
      type
    });
  }
  return segs;
}

/**
 * Computes line-line intersection returning exact point and parameter t along [p1, p2]
 */
function lineIntersect(
  p1: Point2D, p2: Point2D,
  p3: Point2D, p4: Point2D
): { pt: Point2D; t: number } | null {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-7) return null;

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;

  if (t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) {
    const clampedT = Math.max(0, Math.min(1, t));
    return {
      pt: {
        x: p1.x + clampedT * (p2.x - p1.x),
        y: p1.y + clampedT * (p2.y - p1.y)
      },
      t: clampedT
    };
  }
  return null;
}

/**
 * Checks if a point is strictly inside an ExPolygon's solid area (inside contour, outside all holes)
 */
function isPointInsideExPoly(pt: Point2D, expoly: ExPolygon): boolean {
  if (expoly.bbox) {
    if (
      pt.x < expoly.bbox.minX - 1e-3 ||
      pt.x > expoly.bbox.maxX + 1e-3 ||
      pt.y < expoly.bbox.minY - 1e-3 ||
      pt.y > expoly.bbox.maxY + 1e-3
    ) {
      return false;
    }
  }
  if (!isPointInPolygon(pt, expoly.contour)) return false;
  for (let i = 0; i < expoly.holes.length; i++) {
    if (isPointInPolygon(pt, expoly.holes[i])) return false;
  }
  return true;
}

/**
 * Checks if a point is inside any ExPolygon in a given layer
 */
function isPointInsideLayer(pt: Point2D, expolygons: ExPolygon[]): boolean {
  for (let i = 0; i < expolygons.length; i++) {
    if (isPointInsideExPoly(pt, expolygons[i])) return true;
  }
  return false;
}

/**
 * Generates solid skin or sparse infill pattern for an ExPolygon, correctly identifying
 * top and bottom surfaces at intermediate layers as well as global top/bottom.
 */
function generateInfillForExPolygon(
  rawExPoly: ExPolygon,
  z: number,
  layerIndex: number,
  totalLayers: number,
  allLayerExPolygons: ExPolygon[][],
  settings: SlicerSettings
): Segment2D[] {
  const segments: Segment2D[] = [];

  const wallOffset = (Math.max(1, settings.wallCount) - 1) * settings.wallGapDistance;
  const infillContour = wallOffset > 0 ? offsetPolygon(rawExPoly.contour, -wallOffset) : rawExPoly.contour;
  const infillHoles = rawExPoly.holes.map(h => wallOffset > 0 ? offsetPolygon(h, wallOffset) : h);
  const expoly: ExPolygon = {
    contour: infillContour,
    holes: infillHoles,
    bbox: computeBBox(infillContour)
  };

  const bbox = expoly.bbox;

  const isGlobalBottom = layerIndex < settings.bottomSolidLayers;
  const isGlobalTop = layerIndex >= totalLayers - settings.topSolidLayers;

  const solidSpacing = settings.nozzleDiameter * 0.95;
  const solidAngleDeg = (layerIndex % 2 === 0) ? 45 : 135;

  const sparseDensity = settings.infillDensity;
  const sparseSpacing = Math.max(settings.nozzleDiameter * 1.5, (settings.nozzleDiameter * 100) / Math.max(1, sparseDensity));

  // Helper to test if a point is on a top surface (air above within topSolidLayers)
  const isTopSkin = (pt: Point2D): boolean => {
    if (isGlobalTop) return true;
    const maxL = Math.min(totalLayers - 1, layerIndex + settings.topSolidLayers);
    for (let k = layerIndex + 1; k <= maxL; k++) {
      if (!isPointInsideLayer(pt, allLayerExPolygons[k])) {
        return true;
      }
    }
    return false;
  };

  // Helper to test if a point is on a bottom surface (air below within bottomSolidLayers)
  const isBottomSkin = (pt: Point2D): boolean => {
    if (isGlobalBottom) return true;
    const minL = Math.max(0, layerIndex - settings.bottomSolidLayers);
    for (let k = layerIndex - 1; k >= minL; k--) {
      if (!isPointInsideLayer(pt, allLayerExPolygons[k])) {
        return true;
      }
    }
    return false;
  };

  // Helper to process line segments against ExPolygon boundaries with sub-segment skin classification
  const processHatchLine = (p1: Point2D, p2: Point2D, mode: 'solid' | 'sparse') => {
    const rawHits: { t: number; pt: Point2D }[] = [];
    const testPoly = (poly: Point2D[]) => {
      const n = poly.length;
      for (let j = 0; j < n; j++) {
        const hit = lineIntersect(p1, p2, poly[j], poly[(j + 1) % n]);
        if (hit) rawHits.push(hit);
      }
    };

    testPoly(expoly.contour);
    for (const h of expoly.holes) {
      testPoly(h);
    }

    if (rawHits.length < 2) return;

    rawHits.sort((a, b) => a.t - b.t);
    const uniqueHits: { t: number; pt: Point2D }[] = [];
    for (const h of rawHits) {
      if (uniqueHits.length === 0 || h.t - uniqueHits[uniqueHits.length - 1].t > 1e-4) {
        uniqueHits.push(h);
      }
    }

    for (let k = 0; k + 1 < uniqueHits.length; k++) {
      const tA = uniqueHits[k].t;
      const tB = uniqueHits[k + 1].t;
      if (tB - tA < 1e-4) continue;

      const ptA = uniqueHits[k].pt;
      const ptB = uniqueHits[k + 1].pt;
      const segLen = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
      if (segLen < 0.05) continue;

      const midPt: Point2D = {
        x: (ptA.x + ptB.x) * 0.5,
        y: (ptA.y + ptB.y) * 0.5
      };

      // Crucial: Must be strictly inside the solid area of the ExPolygon (never in holes or void)
      if (!isPointInsideExPoly(midPt, expoly)) continue;

      if (isGlobalTop || isGlobalBottom) {
        if (mode === 'solid') {
          segments.push({ a: ptA, b: ptB, type: 'solid_infill' });
        }
        continue;
      }

      // Intermediate layer: Check if segment spans top/bottom skin vs core infill
      const stepSize = Math.max(0.35, Math.min(0.8, settings.nozzleDiameter));
      const numSteps = Math.max(1, Math.ceil(segLen / stepSize));

      let runStart: Point2D | null = null;
      let lastPt: Point2D = ptA;

      for (let s = 0; s < numSteps; s++) {
        const t0 = s / numSteps;
        const t1 = (s + 1) / numSteps;
        const tM = (t0 + t1) * 0.5;
        const samplePt: Point2D = {
          x: ptA.x + tM * (ptB.x - ptA.x),
          y: ptA.y + tM * (ptB.y - ptA.y)
        };
        const curStartPt: Point2D = {
          x: ptA.x + t0 * (ptB.x - ptA.x),
          y: ptA.y + t0 * (ptB.y - ptA.y)
        };
        const curEndPt: Point2D = {
          x: ptA.x + t1 * (ptB.x - ptA.x),
          y: ptA.y + t1 * (ptB.y - ptA.y)
        };

        const isSkin = isTopSkin(samplePt) || isBottomSkin(samplePt);
        const match = mode === 'solid' ? isSkin : !isSkin;

        if (match) {
          if (!runStart) {
            runStart = curStartPt;
          }
          lastPt = curEndPt;
        } else {
          if (runStart) {
            segments.push({
              a: runStart,
              b: lastPt,
              type: mode === 'solid' ? 'solid_infill' : 'sparse_infill'
            });
            runStart = null;
          }
        }
      }

      if (runStart) {
        segments.push({
          a: runStart,
          b: ptB,
          type: mode === 'solid' ? 'solid_infill' : 'sparse_infill'
        });
      }
    }
  };

  // Generate Solid Skin Hatches (100% dense lines) with Monotonic / Serpentine / Concentric / Hilbert support
  const generateSolidHatches = (angle: number) => {
    const pattern = settings.solidInfillPattern || 'monotonic';

    if (pattern === 'concentric') {
      // Concentric solid skin (insetting contours)
      let currentContour = expoly.contour;
      for (let ring = 0; ring < 25; ring++) {
        const inset = offsetPolygon(currentContour, -ring * solidSpacing);
        if (inset.length < 3) break;
        const ringSegs = polygonToSegments(inset, 'solid_infill');
        if (ringSegs.length === 0) break;
        segments.push(...ringSegs);
        currentContour = inset;
      }
      return;
    }

    if (pattern === 'hilbert') {
      // Hilbert curve space-filling solid infill approximation
      const minX = bbox.minX, maxX = bbox.maxX;
      const minY = bbox.minY, maxY = bbox.maxY;
      const step = solidSpacing * 1.5;
      for (let y = minY; y <= maxY; y += step) {
        const lineSegs: Point2D[] = [];
        for (let x = minX; x <= maxX; x += step) {
          const pt: Point2D = { x, y };
          if (isPointInsideExPoly(pt, expoly)) {
            lineSegs.push(pt);
          }
        }
        for (let i = 0; i + 1 < lineSegs.length; i++) {
          segments.push({ a: lineSegs[i], b: lineSegs[i + 1], type: 'solid_infill' });
        }
      }
      return;
    }

    // Rectilinear or Monotonic
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const minX = bbox.minX - 2, maxX = bbox.maxX + 2;
    const minY = bbox.minY - 2, maxY = bbox.maxY + 2;
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const diag = Math.hypot(maxX - minX, maxY - minY);

    const numLines = Math.ceil(diag / solidSpacing);
    const startOffset = -diag * 0.5;

    // Collect all raw hatch line segments for this polygon
    const rawHatches: { a: Point2D; b: Point2D }[] = [];

    const interceptCollector = (p1: Point2D, p2: Point2D) => {
      const rawHits: { t: number; pt: Point2D }[] = [];
      const testPoly = (poly: Point2D[]) => {
        const n = poly.length;
        for (let j = 0; j < n; j++) {
          const hit = lineIntersect(p1, p2, poly[j], poly[(j + 1) % n]);
          if (hit) rawHits.push(hit);
        }
      };

      testPoly(expoly.contour);
      for (const h of expoly.holes) {
        testPoly(h);
      }

      if (rawHits.length < 2) return;

      rawHits.sort((a, b) => a.t - b.t);
      const uniqueHits: { t: number; pt: Point2D }[] = [];
      for (const h of rawHits) {
        if (uniqueHits.length === 0 || h.t - uniqueHits[uniqueHits.length - 1].t > 1e-4) {
          uniqueHits.push(h);
        }
      }

      for (let k = 0; k + 1 < uniqueHits.length; k++) {
        const tA = uniqueHits[k].t;
        const tB = uniqueHits[k + 1].t;
        if (tB - tA < 1e-4) continue;

        const ptA = uniqueHits[k].pt;
        const ptB = uniqueHits[k + 1].pt;
        const segLen = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
        if (segLen < 0.05) continue;

        const midPt: Point2D = {
          x: (ptA.x + ptB.x) * 0.5,
          y: (ptA.y + ptB.y) * 0.5
        };

        if (isPointInsideExPoly(midPt, expoly)) {
          rawHatches.push({ a: ptA, b: ptB });
        }
      }
    };

    for (let i = 0; i <= numLines; i++) {
      const offset = startOffset + i * solidSpacing;
      const lx1 = offset, ly1 = -diag * 0.5;
      const lx2 = offset, ly2 = diag * 0.5;

      const p1: Point2D = {
        x: cx + lx1 * cos - ly1 * sin,
        y: cy + lx1 * sin + ly1 * cos
      };
      const p2: Point2D = {
        x: cx + lx2 * cos - ly2 * sin,
        y: cy + lx2 * sin + ly2 * cos
      };

      interceptCollector(p1, p2);
    }

    if (rawHatches.length === 0) return;

    if (pattern === 'monotonic') {
      // Monotonic ordering: Sort lines left-to-right (or bottom-to-top),
      // and alternate direction (serpentine) so consecutive lines start from closest point
      // (e.g. line 1: left->right, line 2: right->left, line 3: left->right)
      rawHatches.sort((h1, h2) => (h1.a.x + h1.b.x) - (h2.a.x + h2.b.x));

      let currentPosition: Point2D = { x: -1000, y: -1000 };

      for (let i = 0; i < rawHatches.length; i++) {
        const hatch = rawHatches[i];
        // Distance from current nozzle head to hatch.a vs hatch.b
        const distA = Math.hypot(hatch.a.x - currentPosition.x, hatch.a.y - currentPosition.y);
        const distB = Math.hypot(hatch.b.x - currentPosition.x, hatch.b.y - currentPosition.y);

        let startPt = hatch.a;
        let endPt = hatch.b;

        // If 'b' is closer, or by monotonic alternating rule, pick closest start point
        if (distB < distA) {
          startPt = hatch.b;
          endPt = hatch.a;
        }

        segments.push({ a: startPt, b: endPt, type: 'solid_infill' });
        currentPosition = endPt;
      }
    } else {
      // Standard rectilinear: All lines start on same side or alternating without closest-point routing
      for (const h of rawHatches) {
        segments.push({ a: h.a, b: h.b, type: 'solid_infill' });
      }
    }
  };

  // Generate Hatch Lines (for both solid skin or sparse infill)
  const generateHatchLines = (angle: number, mode: 'solid' | 'sparse', spacing: number) => {
    if (isGlobalTop || isGlobalBottom) return;

    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const minX = bbox.minX - 2, maxX = bbox.maxX + 2;
    const minY = bbox.minY - 2, maxY = bbox.maxY + 2;
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const diag = Math.hypot(maxX - minX, maxY - minY);

    const numLines = Math.ceil(diag / spacing);
    const startOffset = -diag * 0.5;

    for (let i = 0; i <= numLines; i++) {
      const offset = startOffset + i * spacing;
      const lx1 = offset, ly1 = -diag * 0.5;
      const lx2 = offset, ly2 = diag * 0.5;

      const p1: Point2D = {
        x: cx + lx1 * cos - ly1 * sin,
        y: cy + lx1 * sin + ly1 * cos
      };
      const p2: Point2D = {
        x: cx + lx2 * cos - ly2 * sin,
        y: cy + lx2 * sin + ly2 * cos
      };

      processHatchLine(p1, p2, mode);
    }
  };

  // 1. Generate solid skin
  if (isGlobalTop || isGlobalBottom) {
    generateSolidHatches(solidAngleDeg);
  }

  // 2. Generate intermediate solid skin and sparse infill
  if (!isGlobalTop && !isGlobalBottom) {
    // Always generate intermediate solid skin
    generateHatchLines(solidAngleDeg, 'solid', solidSpacing);

    // Generate sparse infill (if density > 0)
    if (sparseDensity > 0) {
      if (settings.infillPattern === 'grid') {
        generateHatchLines(45, 'sparse', sparseSpacing);
        generateHatchLines(135, 'sparse', sparseSpacing);
      } else if (settings.infillPattern === 'triangles') {
        generateHatchLines(0, 'sparse', sparseSpacing);
        generateHatchLines(60, 'sparse', sparseSpacing);
        generateHatchLines(120, 'sparse', sparseSpacing);
      } else if (settings.infillPattern === 'lines') {
        generateHatchLines(layerIndex % 2 === 0 ? 45 : 135, 'sparse', sparseSpacing);
      } else {
        generateHatchLines(45 + Math.sin(z * 1.5) * 30, 'sparse', sparseSpacing);
      }
    }
  }

  return segments;
}

/**
 * Generates Skirt or Brim around layer 1
 */
function generateSkirtBrim(
  expolygons: ExPolygon[],
  settings: SlicerSettings
): Segment2D[] {
  const segments: Segment2D[] = [];
  if (settings.adhesionType === 'none' || expolygons.length === 0) return segments;

  const isBrim = settings.adhesionType === 'brim';
  const loops = isBrim ? Math.max(3, Math.round(settings.brimWidth / settings.nozzleDiameter)) : settings.skirtLoops;
  const initialOffset = isBrim ? settings.nozzleDiameter * 0.5 : settings.skirtOffset;

  for (const expoly of expolygons) {
    for (let loopIdx = 0; loopIdx < loops; loopIdx++) {
      const offset = initialOffset + loopIdx * (settings.nozzleDiameter * 0.9);
      const skirtContour = offsetPolygon(expoly.contour, offset);
      segments.push(...polygonToSegments(skirtContour, 'skirt'));
    }
  }

  return segments;
}

/**
 * ========================================================
 * Support Generation Engine (Regular, Tree, Minimal Surface)
 * ========================================================
 */

interface OverhangContactPoint {
  x: number;
  y: number;
  z: number;
  areaWeight: number;
}

interface OverhangPatch {
  id: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  topZ: number;
  bottomZ: number;
  points: Point2D[];
}

interface TreeBranch {
  id: number;
  tipX: number;
  tipY: number;
  topZ: number;
  bottomZ: number;
  dirX: number;
  dirY: number;
}

function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function isPointClearOfModel(pt: Point2D, expolygons: ExPolygon[], clearance: number): boolean {
  for (let e = 0; e < expolygons.length; e++) {
    const expoly = expolygons[e];
    if (isPointInPolygon(pt, expoly.contour)) {
      let inHole = false;
      for (let h = 0; h < expoly.holes.length; h++) {
        if (isPointInPolygon(pt, expoly.holes[h])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return false;
    }

    const c = expoly.contour;
    for (let i = 0; i < c.length; i++) {
      const a = c[i];
      const b = c[(i + 1) % c.length];
      if (distanceToSegment(pt, a, b) < clearance) return false;
    }

    for (let h = 0; h < expoly.holes.length; h++) {
      const hole = expoly.holes[h];
      for (let i = 0; i < hole.length; i++) {
        const a = hole[i];
        const b = hole[(i + 1) % hole.length];
        if (distanceToSegment(pt, a, b) < clearance) return false;
      }
    }
  }
  return true;
}

function analyzeSupportStructures(
  triangles: TriangleSimple[],
  minZ: number,
  bbox: THREE.Box3,
  settings: SlicerSettings
): { overhangPatches: OverhangPatch[]; treeBranches: TreeBranch[] } {
  if (!settings.enableSupports) {
    return { overhangPatches: [], treeBranches: [] };
  }

  const overhangPoints: OverhangContactPoint[] = [];
  const modelCenterX = (bbox.min.x + bbox.max.x) * 0.5;
  const modelCenterY = (bbox.min.y + bbox.max.y) * 0.5;

  for (let i = 0; i < triangles.length; i++) {
    const tri = triangles[i];
    const p1 = tri.p1;
    const p2 = tri.p2;
    const p3 = tri.p3;

    const edge1 = new THREE.Vector3().subVectors(p2, p1);
    const edge2 = new THREE.Vector3().subVectors(p3, p1);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2);
    const len = normal.length();

    if (len > 1e-6) {
      normal.divideScalar(len);
      const faceMinZ = tri.minZ;

      // Downward facing face elevated above the bed
      if (normal.z < -0.05 && faceMinZ > minZ + 0.4) {
        // Angle from vertical axis Z (0° = vertical wall, 90° = horizontal ceiling)
        const overhangAngleDeg = Math.asin(Math.min(1, Math.max(0, -normal.z))) * (180 / Math.PI);
        if (overhangAngleDeg >= settings.supportOverhangAngle) {
          const area = len * 0.5;
          const cx = (p1.x + p2.x + p3.x) / 3;
          const cy = (p1.y + p2.y + p3.y) / 3;
          const cz = (p1.z + p2.z + p3.z) / 3;

          overhangPoints.push({ x: cx, y: cy, z: cz, areaWeight: area });

          // Sample additional interior points for larger faces
          if (area > 3) {
            overhangPoints.push({ x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5, z: (p1.z + p2.z) * 0.5, areaWeight: area * 0.25 });
            overhangPoints.push({ x: (p2.x + p3.x) * 0.5, y: (p2.y + p3.y) * 0.5, z: (p2.z + p3.z) * 0.5, areaWeight: area * 0.25 });
            overhangPoints.push({ x: (p3.x + p1.x) * 0.5, y: (p3.y + p1.y) * 0.5, z: (p3.z + p1.z) * 0.5, areaWeight: area * 0.25 });
          }
        }
      }
    }
  }

  if (overhangPoints.length === 0) {
    return { overhangPatches: [], treeBranches: [] };
  }

  // 1. Cluster for Regular / Minimal Surface Support Patches
  const patchClusterDist = 4.0;
  const patches: OverhangPatch[] = [];

  for (const pt of overhangPoints) {
    let matchedPatch: OverhangPatch | null = null;
    for (const p of patches) {
      if (
        pt.x >= p.minX - patchClusterDist &&
        pt.x <= p.maxX + patchClusterDist &&
        pt.y >= p.minY - patchClusterDist &&
        pt.y <= p.maxY + patchClusterDist
      ) {
        matchedPatch = p;
        break;
      }
    }

    if (matchedPatch) {
      matchedPatch.minX = Math.min(matchedPatch.minX, pt.x);
      matchedPatch.maxX = Math.max(matchedPatch.maxX, pt.x);
      matchedPatch.minY = Math.min(matchedPatch.minY, pt.y);
      matchedPatch.maxY = Math.max(matchedPatch.maxY, pt.y);
      matchedPatch.topZ = Math.max(matchedPatch.topZ, pt.z);
      matchedPatch.points.push({ x: pt.x, y: pt.y });
    } else {
      patches.push({
        id: patches.length + 1,
        minX: pt.x,
        maxX: pt.x,
        minY: pt.y,
        maxY: pt.y,
        topZ: pt.z,
        bottomZ: minZ,
        points: [{ x: pt.x, y: pt.y }]
      });
    }
  }

  // 2. Cluster for Tree Branches (tip grouping)
  const treeBranchClusterDist = 3.5;
  const branches: TreeBranch[] = [];

  for (const pt of overhangPoints) {
    let nearestBranch: TreeBranch | null = null;
    let minDist = treeBranchClusterDist;

    for (const b of branches) {
      const d = Math.hypot(pt.x - b.tipX, pt.y - b.tipY);
      if (d < minDist) {
        minDist = d;
        nearestBranch = b;
      }
    }

    if (nearestBranch) {
      nearestBranch.tipX = (nearestBranch.tipX + pt.x) * 0.5;
      nearestBranch.tipY = (nearestBranch.tipY + pt.y) * 0.5;
      nearestBranch.topZ = Math.max(nearestBranch.topZ, pt.z);
    } else {
      const dx = pt.x - modelCenterX;
      const dy = pt.y - modelCenterY;
      const dLen = Math.hypot(dx, dy) || 1;

      branches.push({
        id: branches.length + 1,
        tipX: pt.x,
        tipY: pt.y,
        topZ: pt.z,
        bottomZ: minZ,
        dirX: dx / dLen,
        dirY: dy / dLen
      });
    }
  }

  return { overhangPatches: patches, treeBranches: branches };
}

function generateRegularSupportForLayer(
  zPlane: number,
  patches: OverhangPatch[],
  expolygons: ExPolygon[],
  settings: SlicerSettings
): Segment2D[] {
  const segments: Segment2D[] = [];
  const zGap = settings.supportZDistance;
  const xyClearance = settings.supportXyDistance;
  const density = Math.max(8, Math.min(45, settings.supportDensity));
  const lineSpacing = settings.nozzleDiameter / (density / 100);

  for (const patch of patches) {
    if (zPlane > patch.topZ - zGap || zPlane < patch.bottomZ) continue;

    const isInterface = zPlane >= patch.topZ - zGap - (2 * settings.layerHeight);
    const segType: Segment2D['type'] = isInterface ? 'support_interface' : 'support';
    const effectiveSpacing = isInterface ? Math.min(0.8, lineSpacing * 0.4) : lineSpacing;

    const x0 = patch.minX - 0.8;
    const x1 = patch.maxX + 0.8;
    const y0 = patch.minY - 0.8;
    const y1 = patch.maxY + 0.8;

    // 1. Column Boundary Box
    const boxPts: Point2D[] = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 }
    ];

    for (let i = 0; i < 4; i++) {
      const a = boxPts[i];
      const b = boxPts[(i + 1) % 4];
      if (isPointClearOfModel(a, expolygons, xyClearance) && isPointClearOfModel(b, expolygons, xyClearance)) {
        segments.push({ a, b, type: segType });
      }
    }

    // 2. Column Infill Lines (Alternating 0° / 90° or Dense Interface)
    const isEvenLayer = Math.round(zPlane / settings.layerHeight) % 2 === 0;
    if (isEvenLayer || isInterface) {
      for (let y = y0 + effectiveSpacing; y < y1; y += effectiveSpacing) {
        const a: Point2D = { x: x0 + 0.4, y };
        const b: Point2D = { x: x1 - 0.4, y };
        if (isPointClearOfModel(a, expolygons, xyClearance) && isPointClearOfModel(b, expolygons, xyClearance)) {
          segments.push({ a, b, type: segType });
        }
      }
    }
    if (!isEvenLayer || isInterface) {
      for (let x = x0 + effectiveSpacing; x < x1; x += effectiveSpacing) {
        const a: Point2D = { x, y: y0 + 0.4 };
        const b: Point2D = { x, y: y1 - 0.4 };
        if (isPointClearOfModel(a, expolygons, xyClearance) && isPointClearOfModel(b, expolygons, xyClearance)) {
          segments.push({ a, b, type: segType });
        }
      }
    }
  }

  return segments;
}

function generateTreeSupportForLayer(
  zPlane: number,
  branches: TreeBranch[],
  expolygons: ExPolygon[],
  settings: SlicerSettings
): Segment2D[] {
  const segments: Segment2D[] = [];
  const zGap = settings.supportZDistance;
  const xyClearance = settings.supportXyDistance;

  for (const branch of branches) {
    if (zPlane > branch.topZ - zGap || zPlane < branch.bottomZ) continue;

    const isContactTip = zPlane >= branch.topZ - zGap - (1.5 * settings.layerHeight);
    const segType: Segment2D['type'] = isContactTip ? 'support_interface' : 'support';

    // Organic expansion from tip downwards to build plate
    const distFromTip = Math.max(0, branch.topZ - zGap - zPlane);
    const radius = Math.min(5.2, 1.4 + distFromTip * 0.07);

    let cx = branch.tipX + branch.dirX * Math.min(distFromTip * 0.05, 3.5);
    let cy = branch.tipY + branch.dirY * Math.min(distFromTip * 0.05, 3.5);

    // Push away from model if center encroaches on model
    if (!isPointClearOfModel({ x: cx, y: cy }, expolygons, xyClearance)) {
      cx += branch.dirX * (xyClearance + 1.0);
      cy += branch.dirY * (xyClearance + 1.0);
    }

    // 10-sided regular polygon trunk outline
    const sides = 10;
    const polyPts: Point2D[] = [];
    for (let k = 0; k < sides; k++) {
      const angle = (k * 2 * Math.PI) / sides;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      polyPts.push({ x: px, y: py });
    }

    for (let k = 0; k < sides; k++) {
      const a = polyPts[k];
      const b = polyPts[(k + 1) % sides];
      if (isPointClearOfModel(a, expolygons, xyClearance) && isPointClearOfModel(b, expolygons, xyClearance)) {
        segments.push({ a, b, type: segType });
      }
    }

    // Inner cross brace for stability on thicker trunks
    if (radius > 2.6 && !isContactTip) {
      const innerR = radius * 0.6;
      const p1: Point2D = { x: cx - innerR, y: cy };
      const p2: Point2D = { x: cx + innerR, y: cy };
      const p3: Point2D = { x: cx, y: cy - innerR };
      const p4: Point2D = { x: cx, y: cy + innerR };
      if (isPointClearOfModel(p1, expolygons, xyClearance) && isPointClearOfModel(p2, expolygons, xyClearance)) {
        segments.push({ a: p1, b: p2, type: 'support' });
      }
      if (isPointClearOfModel(p3, expolygons, xyClearance) && isPointClearOfModel(p4, expolygons, xyClearance)) {
        segments.push({ a: p3, b: p4, type: 'support' });
      }
    }

    // Contact interface pad at branch tip
    if (isContactTip) {
      const rInt = radius * 0.8;
      const h1: Point2D = { x: cx - rInt, y: cy };
      const h2: Point2D = { x: cx + rInt, y: cy };
      const v1: Point2D = { x: cx, y: cy - rInt };
      const v2: Point2D = { x: cx, y: cy + rInt };
      if (isPointClearOfModel(h1, expolygons, xyClearance) && isPointClearOfModel(h2, expolygons, xyClearance)) {
        segments.push({ a: h1, b: h2, type: 'support_interface' });
      }
      if (isPointClearOfModel(v1, expolygons, xyClearance) && isPointClearOfModel(v2, expolygons, xyClearance)) {
        segments.push({ a: v1, b: v2, type: 'support_interface' });
      }
    }
  }

  return segments;
}

function generateMinimalSurfaceSupportForLayer(
  zPlane: number,
  minZ: number,
  patches: OverhangPatch[],
  expolygons: ExPolygon[],
  settings: SlicerSettings
): Segment2D[] {
  const segments: Segment2D[] = [];
  const zGap = settings.supportZDistance;
  const xyClearance = settings.supportXyDistance;
  const density = Math.max(8, Math.min(45, settings.supportDensity));

  // Triply Periodic Minimal Surface (Schwarz P / Gyroid) cell period
  const cellSize = 6.0 * (20 / density);
  const zRel = zPlane - minZ;
  const phaseZ = (2 * Math.PI * zRel) / cellSize;
  const cZ = Math.cos(phaseZ);

  for (const patch of patches) {
    if (zPlane > patch.topZ - zGap || zPlane < patch.bottomZ) continue;

    const isInterface = zPlane >= patch.topZ - zGap - (2 * settings.layerHeight);
    const segType: Segment2D['type'] = isInterface ? 'support_interface' : 'support';

    const x0 = patch.minX - 0.8;
    const x1 = patch.maxX + 0.8;
    const y0 = patch.minY - 0.8;
    const y1 = patch.maxY + 0.8;

    // Outer anchor box boundary
    const boxPts: Point2D[] = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 }
    ];
    for (let i = 0; i < 4; i++) {
      const a = boxPts[i];
      const b = boxPts[(i + 1) % 4];
      if (isPointClearOfModel(a, expolygons, xyClearance) && isPointClearOfModel(b, expolygons, xyClearance)) {
        segments.push({ a, b, type: segType });
      }
    }

    if (isInterface) {
      // Dense interface surface grid
      const ifSpacing = 0.8;
      for (let y = y0 + ifSpacing; y < y1; y += ifSpacing) {
        const a: Point2D = { x: x0 + 0.3, y };
        const b: Point2D = { x: x1 - 0.3, y };
        if (isPointClearOfModel(a, expolygons, xyClearance) && isPointClearOfModel(b, expolygons, xyClearance)) {
          segments.push({ a, b, type: 'support_interface' });
        }
      }
    } else {
      // Continuous Schwarz P minimal surface sinusoidal wave path
      const lineStepY = cellSize * 0.35;
      const amplitude = Math.max(0.4, (cellSize * 0.22) * Math.sqrt(Math.max(0.1, 1.0 - cZ * cZ * 0.4)));

      for (let baseCy = y0 + lineStepY * 0.5; baseCy <= y1; baseCy += lineStepY) {
        const stepX = 0.8;
        let lastPt: Point2D | null = null;

        for (let x = x0; x <= x1; x += stepX) {
          const waveY = baseCy + amplitude * Math.sin((2 * Math.PI * x) / cellSize + phaseZ);
          const currentPt: Point2D = { x, y: waveY };

          if (isPointClearOfModel(currentPt, expolygons, xyClearance)) {
            if (lastPt) {
              segments.push({ a: lastPt, b: currentPt, type: 'support' });
            }
            lastPt = currentPt;
          } else {
            lastPt = null;
          }
        }
      }
    }
  }

  return segments;
}

function generateSupportsForLayer(
  zPlane: number,
  minZ: number,
  expolygons: ExPolygon[],
  patches: OverhangPatch[],
  branches: TreeBranch[],
  settings: SlicerSettings
): Segment2D[] {
  if (settings.supportStyle === 'tree') {
    return generateTreeSupportForLayer(zPlane, branches, expolygons, settings);
  } else if (settings.supportStyle === 'minimal_surface') {
    return generateMinimalSurfaceSupportForLayer(zPlane, minZ, patches, expolygons, settings);
  } else {
    return generateRegularSupportForLayer(zPlane, patches, expolygons, settings);
  }
}

/**
 * Main Slicing Pipeline
 */
export function sliceModel(
  geometry: THREE.BufferGeometry,
  modelMatrix: THREE.Matrix4,
  settings: SlicerSettings,
  onProgress?: (percent: number, status: string) => void
): SliceResult {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  nonIndexed.applyMatrix4(modelMatrix);
  nonIndexed.computeBoundingBox();

  const bbox = nonIndexed.boundingBox!;
  const minZ = bbox.min.z;
  const maxZ = bbox.max.z;
  const totalHeight = maxZ - minZ;

  if (totalHeight <= 0.05) {
    throw new Error('Model has zero or negative vertical thickness.');
  }

  // Pre-sort triangles into 3D structure
  onProgress?.(10, 'Extracting surface mesh triangles...');
  const posAttr = nonIndexed.getAttribute('position');
  const count = posAttr.count / 3;
  const triangles: TriangleSimple[] = [];

  for (let i = 0; i < count; i++) {
    const p1 = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3);
    const p2 = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 1);
    const p3 = new THREE.Vector3().fromBufferAttribute(posAttr, i * 3 + 2);

    const tMinZ = Math.min(p1.z, p2.z, p3.z);
    const tMaxZ = Math.max(p1.z, p2.z, p3.z);

    triangles.push({ p1, p2, p3, minZ: tMinZ, maxZ: tMaxZ });
  }

  // Pre-analyze model geometry for overhang surfaces and support scaffolds
  onProgress?.(15, 'Detecting overhang angles & generating support scaffolding...');
  const { overhangPatches, treeBranches } = analyzeSupportStructures(triangles, minZ, bbox, settings);

  // Calculate slice layers
  const slicedLayers: SlicedLayer[] = [];
  let currentZ = minZ + settings.firstLayerHeight;
  const layerHeights: number[] = [];

  while (currentZ <= maxZ + 1e-4) {
    layerHeights.push(currentZ);
    currentZ += settings.layerHeight;
  }

  // Ensure top of model is not omitted if maxZ slightly exceeds layer bounds
  if (layerHeights.length === 0 || layerHeights[layerHeights.length - 1] < maxZ - 0.02) {
    layerHeights.push(maxZ);
  }

  const totalLayers = Math.max(1, layerHeights.length);

  // PHASE 1: Pre-slice all layers into ExPolygons
  onProgress?.(20, 'Extracting 2D layer cross-sections & detecting cavities...');
  const allLayerExPolygons: ExPolygon[][] = [];

  for (let lIdx = 0; lIdx < totalLayers; lIdx++) {
    // Slicing at the vertical center of each layer's extrusion volume
    // ensures horizontal steps, pocket floors, internal shelves, and ceilings are accurately captured
    // without degenerate coplanar slicing or off-by-one layer gaps.
    const zPlane = lIdx === 0
      ? minZ + settings.firstLayerHeight * 0.5
      : (layerHeights[lIdx - 1] + layerHeights[lIdx]) * 0.5;
    const rawSegments: { start: Point2D; end: Point2D }[] = [];

    for (let t = 0; t < triangles.length; t++) {
      const tri = triangles[t];
      if (tri.minZ > zPlane || tri.maxZ < zPlane) continue;

      const ptsOnPlane: Point2D[] = [];

      const checkEdge = (va: THREE.Vector3, vb: THREE.Vector3) => {
        if ((va.z <= zPlane && vb.z >= zPlane) || (va.z >= zPlane && vb.z <= zPlane)) {
          const diff = vb.z - va.z;
          if (Math.abs(diff) > 1e-6) {
            const frac = (zPlane - va.z) / diff;
            const p: Point2D = {
              x: va.x + (vb.x - va.x) * frac,
              y: va.y + (vb.y - va.y) * frac
            };
            if (!ptsOnPlane.some(u => Math.hypot(u.x - p.x, u.y - p.y) < 1e-4)) {
              ptsOnPlane.push(p);
            }
          }
        }
      };

      checkEdge(tri.p1, tri.p2);
      checkEdge(tri.p2, tri.p3);
      checkEdge(tri.p3, tri.p1);

      if (ptsOnPlane.length === 2) {
        const d = Math.hypot(ptsOnPlane[1].x - ptsOnPlane[0].x, ptsOnPlane[1].y - ptsOnPlane[0].y);
        if (d > 0.02) {
          rawSegments.push({ start: ptsOnPlane[0], end: ptsOnPlane[1] });
        }
      }
    }

    const loops = stitchSegmentsToLoops(rawSegments);
    const expolygons = groupLoopsIntoExPolygons(loops);
    allLayerExPolygons.push(expolygons);

    if (lIdx % 20 === 0 || lIdx === totalLayers - 1) {
      const pct = Math.round(20 + (lIdx / totalLayers) * 20);
      onProgress?.(pct, `Extracting cross-sections: layer ${lIdx + 1} of ${totalLayers}...`);
    }
  }

  // PHASE 2: Generate perimeters, solid top/bottom skins, infill, and supports
  onProgress?.(40, 'Generating perimeters, solid top/bottom skins, and infill...');

  for (let lIdx = 0; lIdx < totalLayers; lIdx++) {
    const zPlane = layerHeights[lIdx];
    const expolygons = allLayerExPolygons[lIdx];
    const layerSegments: Segment2D[] = [];

    // Skirt/Brim on layer 0
    if (lIdx === 0) {
      const skirt = generateSkirtBrim(expolygons, settings);
      layerSegments.push(...skirt);
    }

    // Generate Perimeters & Infill for each ExPolygon
    for (const expoly of expolygons) {
      // 1. Outermost Wall
      const outerWall = polygonToSegments(expoly.contour, 'outer_wall');
      layerSegments.push(...outerWall);

      // Hole boundaries touching open air cavity (outermost wall for hole)
      for (const hole of expoly.holes) {
        layerSegments.push(...polygonToSegments(hole, 'outer_wall'));
      }

      // 2. Extra concentric inner perimeter loops
      for (let w = 1; w < settings.wallCount; w++) {
        const insetContour = offsetPolygon(expoly.contour, -w * settings.wallGapDistance);
        if (insetContour.length >= 3) {
          layerSegments.push(...polygonToSegments(insetContour, 'inner_wall'));
        }

        for (const hole of expoly.holes) {
          const offsetHole = offsetPolygon(hole, w * settings.wallGapDistance);
          if (offsetHole.length >= 3) {
            layerSegments.push(...polygonToSegments(offsetHole, 'inner_wall'));
          }
        }
      }

      // 3. Infill (Solid Top/Bottom Skin or Sparse)
      const infill = generateInfillForExPolygon(
        expoly,
        zPlane,
        lIdx,
        totalLayers,
        allLayerExPolygons,
        settings
      );
      layerSegments.push(...infill);
    }

    // 4. Support Structures (Regular, Tree, Minimal Surface)
    if (settings.enableSupports && (overhangPatches.length > 0 || treeBranches.length > 0)) {
      const supportSegs = generateSupportsForLayer(
        zPlane,
        minZ,
        expolygons,
        overhangPatches,
        treeBranches,
        settings
      );
      layerSegments.push(...supportSegs);
    }

    slicedLayers.push({
      layerIndex: lIdx + 1,
      z: zPlane - minZ, // normalized Z relative to bed surface
      height: lIdx === 0 ? settings.firstLayerHeight : settings.layerHeight,
      expolygons,
      segments: layerSegments
    });

    if (lIdx % 10 === 0 || lIdx === totalLayers - 1) {
      const pct = Math.round(40 + (lIdx / totalLayers) * 45);
      onProgress?.(pct, `Generating toolpaths: layer ${lIdx + 1} of ${totalLayers}...`);
    }
  }

  // Generate G-Code
  onProgress?.(85, 'Translating toolpaths to RepRap / Marlin G-Code...');
  const { gcode, stats } = generateGCode(slicedLayers, settings, {
    minX: bbox.min.x,
    maxX: bbox.max.x,
    minY: bbox.min.y,
    maxY: bbox.max.y,
    minZ: 0,
    maxZ: totalHeight
  });

  onProgress?.(100, 'Slicing finished successfully!');

  return {
    layers: slicedLayers,
    gcode,
    stats
  };
}

/**
 * Standard G-Code generation with RepRap / Marlin compliance
 */
function generateGCode(
  layers: SlicedLayer[],
  settings: SlicerSettings,
  bounds: GCodeStats['bounds']
): { gcode: string; stats: GCodeStats } {
  let gcode = '';
  let globalE = 0.0;
  let totalTimeSeconds = 0;
  let totalMoves = 0;

  const printer = PRINTER_PROFILES.find(p => p.id === settings.printerId) || PRINTER_PROFILES[0];
  const bedOffsetX = printer.shape === 'rectangular' ? printer.bedWidth / 2 : 0;
  const bedOffsetY = printer.shape === 'rectangular' ? printer.bedDepth / 2 : 0;

  const filamentArea = Math.PI * Math.pow(settings.filamentDiameter / 2, 2);

  const computeEStep = (dist: number, layerHeight: number) => {
    const extrudedArea = layerHeight * settings.nozzleDiameter * settings.extrusionMultiplier;
    return (dist * extrudedArea) / filamentArea;
  };

  const printMinX = bounds.minX + bedOffsetX;
  const printMaxX = bounds.maxX + bedOffsetX;
  const printMinY = bounds.minY + bedOffsetY;
  const printMaxY = bounds.maxY + bedOffsetY;

  // Header
  gcode += `; ========================================================\n`;
  gcode += `; Generated by Vibey Slicer - The Vibecoded, Self-Hosted, Privacy Based Slicer\n`;
  gcode += `; Target Printer: ${printer.name} (${printer.bedWidth}x${printer.bedDepth}x${printer.maxHeight} mm)\n`;
  gcode += `; Total Layers: ${layers.length}\n`;
  gcode += `; Layer Height: ${settings.layerHeight} mm (First Layer: ${settings.firstLayerHeight} mm)\n`;
  gcode += `; Z Range: ${layers.length > 0 ? layers[0].z.toFixed(3) : '0.000'} mm -> ${layers.length > 0 ? layers[layers.length - 1].z.toFixed(3) : '0.000'} mm (Height: ${(bounds.maxZ - bounds.minZ).toFixed(2)} mm)\n`;
  gcode += `; Print Area: X [${printMinX.toFixed(1)}, ${printMaxX.toFixed(1)}] | Y [${printMinY.toFixed(1)}, ${printMaxY.toFixed(1)}] mm\n`;
  gcode += `; Nozzle: ${settings.nozzleDiameter} mm | Filament: ${settings.filamentDiameter} mm\n`;
  gcode += `; Infill: ${settings.infillDensity}% (${settings.infillPattern})\n`;
  gcode += `; Supports: ${settings.enableSupports ? `${settings.supportStyle} (${settings.supportDensity}%, threshold ${settings.supportOverhangAngle} deg)` : 'Disabled'}\n`;
  gcode += `; Bed Temp: ${settings.bedTemp} C | Hotend Temp: ${settings.hotendTemp} C\n`;
  gcode += `; Print Speeds: Perimeter=${settings.perimeterSpeed} mm/s, Infill=${settings.infillSpeed} mm/s, Travel=${settings.travelSpeed} mm/s\n`;
  gcode += `; ========================================================\n\n`;

  // Standard RepRap Initialization
  gcode += `G21 ; millimeter units\n`;
  gcode += `G90 ; absolute coordinates\n`;
  gcode += `M82 ; absolute extrusion mode\n\n`;

  // Heating
  gcode += `; Heating sequence\n`;
  gcode += `M140 S${settings.bedTemp} ; set bed temp\n`;
  gcode += `M104 S${settings.hotendTemp} ; set hotend temp\n`;
  gcode += `M190 S${settings.bedTemp} ; wait for bed temp\n`;
  gcode += `M109 S${settings.hotendTemp} ; wait for hotend temp\n\n`;

  // Homing & Prime
  gcode += `G28 ; home all axes\n`;
  gcode += `G92 E0 ; reset E\n`;
  gcode += `G1 Z5.0 F${settings.travelSpeed * 60} ; safe lift\n\n`;

  gcode += `; Purge / Prime Line\n`;
  gcode += `G0 X5.0 Y15.0 Z0.28 F${settings.travelSpeed * 60}\n`;
  gcode += `G1 X5.0 Y150.0 E8.0 F1500 ; purge pass 1\n`;
  gcode += `G1 X5.4 Y150.0 F${settings.travelSpeed * 60}\n`;
  gcode += `G1 X5.4 Y20.0 E16.0 F1500 ; purge pass 2\n`;
  gcode += `G92 E0 ; reset E\n`;
  gcode += `G1 Z2.0 F3000 ; lift\n\n`;

  let currentHeadPos: Point2D = { x: 5.4, y: 20.0 };

  for (let lIdx = 0; lIdx < layers.length; lIdx++) {
    const layer = layers[lIdx];
    const currentLayerHeight = layer.height;
    const isFirstLayer = lIdx === 0;

    gcode += `\n; --------------------------------------------------------\n`;
    gcode += `; LAYER:${lIdx + 1}/${layers.length} | Z = ${layer.z.toFixed(3)} mm\n`;
    gcode += `; --------------------------------------------------------\n`;
    gcode += `G1 Z${layer.z.toFixed(3)} F${settings.travelSpeed * 60}\n`;
    totalTimeSeconds += 0.5;

    // Turn fan on after first layer
    if (lIdx === 1 && settings.fanSpeed > 0) {
      const fanValue = Math.round((settings.fanSpeed / 100) * 255);
      gcode += `M106 S${fanValue} ; set cooling fan speed\n`;
    }

    // Order segments: skirt -> support -> outer_wall -> inner_wall -> solid_infill -> sparse_infill
    const skirtSegs = layer.segments.filter(s => s.type === 'skirt');
    const supportSegs = layer.segments.filter(s => s.type === 'support' || s.type === 'support_interface');
    const outerWallSegs = layer.segments.filter(s => s.type === 'outer_wall');
    const innerWallSegs = layer.segments.filter(s => s.type === 'inner_wall');
    const solidInfillSegs = layer.segments.filter(s => s.type === 'solid_infill');
    const sparseInfillSegs = layer.segments.filter(s => s.type === 'sparse_infill');

    const orderedSegs = [
      ...skirtSegs,
      ...supportSegs,
      ...outerWallSegs,
      ...innerWallSegs,
      ...solidInfillSegs,
      ...sparseInfillSegs
    ];

    for (let sIdx = 0; sIdx < orderedSegs.length; sIdx++) {
      const seg = orderedSegs[sIdx];
      let speed = settings.perimeterSpeed;
      if (isFirstLayer) speed = settings.firstLayerSpeed;
      else if (seg.type === 'sparse_infill') speed = settings.infillSpeed;
      else if (seg.type === 'solid_infill') speed = settings.infillSpeed * 0.8;
      else if (seg.type === 'support') speed = settings.infillSpeed * 0.9;
      else if (seg.type === 'support_interface') speed = settings.perimeterSpeed * 0.8;

      const ax = seg.a.x + bedOffsetX;
      const ay = seg.a.y + bedOffsetY;
      const bx = seg.b.x + bedOffsetX;
      const by = seg.b.y + bedOffsetY;

      const travelDist = Math.hypot(ax - currentHeadPos.x, ay - currentHeadPos.y);

      // Travel move if not at start
      if (travelDist > 0.05) {
        // Retract
        if (settings.retractionLength > 0) {
          globalE -= settings.retractionLength;
          gcode += `G1 E${globalE.toFixed(5)} F${settings.retractionSpeed * 60} ; retract\n`;
          totalTimeSeconds += settings.retractionLength / settings.retractionSpeed;
        }

        // Z-Hop if enabled
        if (settings.zHop > 0) {
          gcode += `G1 Z${(layer.z + settings.zHop).toFixed(3)} F3000 ; z-hop\n`;
        }

        // Rapid travel
        gcode += `G0 X${ax.toFixed(3)} Y${ay.toFixed(3)} F${settings.travelSpeed * 60} ; travel\n`;
        totalTimeSeconds += travelDist / settings.travelSpeed;
        totalMoves++;

        // Restore Z
        if (settings.zHop > 0) {
          gcode += `G1 Z${layer.z.toFixed(3)} F3000 ; restore Z\n`;
        }

        // Unretract
        if (settings.retractionLength > 0) {
          globalE += settings.retractionLength;
          gcode += `G1 E${globalE.toFixed(5)} F${settings.retractionSpeed * 60} ; unretract\n`;
          totalTimeSeconds += settings.retractionLength / settings.retractionSpeed;
        }
      }

      // Extrude segment
      const segLength = Math.hypot(bx - ax, by - ay);
      if (segLength > 0.01) {
        const eStep = computeEStep(segLength, currentLayerHeight);
        globalE += eStep;

        gcode += `G1 X${bx.toFixed(3)} Y${by.toFixed(3)} E${globalE.toFixed(5)} F${speed * 60}\n`;
        totalTimeSeconds += segLength / speed;
        totalMoves++;
      }

      currentHeadPos = { x: bx, y: by };
    }
  }

  // End G-Code
  gcode += `\n; ========================================================\n`;
  gcode += `; End G-Code\n`;
  gcode += `; ========================================================\n`;
  if (settings.retractionLength > 0) {
    globalE -= settings.retractionLength;
    gcode += `G1 E${globalE.toFixed(5)} F${settings.retractionSpeed * 60} ; final retract\n`;
  }
  gcode += `G91 ; relative positioning\n`;
  gcode += `G1 Z10.0 F3000 ; lift nozzle\n`;
  gcode += `G90 ; absolute positioning\n`;
  gcode += `G1 X0 Y${printer.bedDepth} F${settings.travelSpeed * 60} ; present print\n`;
  gcode += `M104 S0 ; turn off hotend\n`;
  gcode += `M140 S0 ; turn off bed\n`;
  gcode += `M106 S0 ; turn off cooling fan\n`;
  gcode += `M84 ; disable stepper motors\n`;

  // Filament weight calculation
  const filamentVolMm3 = globalE * filamentArea;
  const filamentWeightGrams = filamentVolMm3 * 0.00124; // ~1.24g/cm3
  const filamentLengthMeters = globalE / 1000;
  const estimatedCost = (filamentWeightGrams / 1000) * 20.0; // default $20/kg

  const stats: GCodeStats = {
    totalLayers: layers.length,
    totalFilamentUsedMm: Math.max(0, globalE),
    totalFilamentWeightGrams: Math.max(0, filamentWeightGrams),
    estimatedTimeSeconds: Math.round(totalTimeSeconds * 1.15),
    estimatedCostUsd: estimatedCost,
    totalMoves,
    bounds: {
      minX: printMinX,
      maxX: printMaxX,
      minY: printMinY,
      maxY: printMaxY,
      minZ: bounds.minZ,
      maxZ: bounds.maxZ
    }
  };

  return { gcode, stats };
}
