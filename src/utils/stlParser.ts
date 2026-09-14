import * as THREE from 'three';

export interface Triangle3D {
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  p3: THREE.Vector3;
  normal?: THREE.Vector3;
}

export interface ParsedSTL {
  geometry: THREE.BufferGeometry;
  triangles: Triangle3D[];
  vertexCount: number;
  triangleCount: number;
  dimensions: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
  isAscii: boolean;
  name?: string;
}

/**
 * Checks if a buffer is ASCII STL or Binary STL
 */
function isAsciiSTL(buffer: ArrayBuffer): boolean {
  const reader = new DataView(buffer);
  if (buffer.byteLength < 84) return true; // Too small for binary header

  // Binary STL header is 80 bytes, then a 32-bit integer triangle count
  const numFaces = reader.getUint32(80, true);
  const expectedSize = 84 + numFaces * 50;

  if (expectedSize === buffer.byteLength) {
    return false; // Binary STL size matches exactly
  }

  // Fallback: check first 256 bytes for 'solid' and non-binary printable characters
  const sampleSize = Math.min(256, buffer.byteLength);
  const bytes = new Uint8Array(buffer, 0, sampleSize);
  let hasSolid = false;
  const headerStr = String.fromCharCode(...bytes.slice(0, 10)).toLowerCase();
  if (headerStr.startsWith('solid')) {
    hasSolid = true;
  }

  for (let i = 0; i < sampleSize; i++) {
    const byte = bytes[i];
    // Check for control characters (other than newline, carriage return, tab)
    if (byte < 9 || (byte > 13 && byte < 32)) {
      return false; // Found binary control character
    }
  }

  return hasSolid;
}

/**
 * Parses Binary STL files
 */
function parseBinarySTL(buffer: ArrayBuffer): { positions: Float32Array; normals: Float32Array; triangles: Triangle3D[] } {
  const dataView = new DataView(buffer);
  const triangleCount = dataView.getUint32(80, true);
  
  const positions = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);
  const triangles: Triangle3D[] = [];

  let offset = 84;
  let pIdx = 0;
  let nIdx = 0;

  for (let i = 0; i < triangleCount; i++) {
    if (offset + 50 > buffer.byteLength) break;

    // Normal vector
    const nx = dataView.getFloat32(offset, true);
    const ny = dataView.getFloat32(offset + 4, true);
    const nz = dataView.getFloat32(offset + 8, true);
    offset += 12;

    // Vertex 1
    const v1x = dataView.getFloat32(offset, true);
    const v1y = dataView.getFloat32(offset + 4, true);
    const v1z = dataView.getFloat32(offset + 8, true);
    offset += 12;

    // Vertex 2
    const v2x = dataView.getFloat32(offset, true);
    const v2y = dataView.getFloat32(offset + 4, true);
    const v2z = dataView.getFloat32(offset + 8, true);
    offset += 12;

    // Vertex 3
    const v3x = dataView.getFloat32(offset, true);
    const v3y = dataView.getFloat32(offset + 4, true);
    const v3z = dataView.getFloat32(offset + 8, true);
    offset += 12;

    // Attribute byte count (uint16)
    offset += 2;

    // Assign positions
    positions[pIdx++] = v1x; positions[pIdx++] = v1y; positions[pIdx++] = v1z;
    positions[pIdx++] = v2x; positions[pIdx++] = v2y; positions[pIdx++] = v2z;
    positions[pIdx++] = v3x; positions[pIdx++] = v3y; positions[pIdx++] = v3z;

    // Assign normals for all 3 vertices
    for (let v = 0; v < 3; v++) {
      normals[nIdx++] = nx;
      normals[nIdx++] = ny;
      normals[nIdx++] = nz;
    }

    triangles.push({
      p1: new THREE.Vector3(v1x, v1y, v1z),
      p2: new THREE.Vector3(v2x, v2y, v2z),
      p3: new THREE.Vector3(v3x, v3y, v3z),
      normal: new THREE.Vector3(nx, ny, nz)
    });
  }

  return { positions, normals, triangles };
}

/**
 * Parses ASCII STL files
 */
function parseAsciiSTL(text: string): { positions: Float32Array; normals: Float32Array; triangles: Triangle3D[] } {
  const positionsArr: number[] = [];
  const normalsArr: number[] = [];
  const triangles: Triangle3D[] = [];

  const normalPattern = /facet\s+normal\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  const vertexPattern = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;

  let normalMatch: RegExpExecArray | null;
  let vertexMatch: RegExpExecArray | null;

  while ((normalMatch = normalPattern.exec(text)) !== null) {
    const nx = parseFloat(normalMatch[1]);
    const ny = parseFloat(normalMatch[2]);
    const nz = parseFloat(normalMatch[3]);

    const v1 = vertexPattern.exec(text);
    const v2 = vertexPattern.exec(text);
    const v3 = vertexPattern.exec(text);

    if (v1 && v2 && v3) {
      const v1x = parseFloat(v1[1]), v1y = parseFloat(v1[2]), v1z = parseFloat(v1[3]);
      const v2x = parseFloat(v2[1]), v2y = parseFloat(v2[2]), v2z = parseFloat(v2[3]);
      const v3x = parseFloat(v3[1]), v3y = parseFloat(v3[2]), v3z = parseFloat(v3[3]);

      positionsArr.push(v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z);
      normalsArr.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);

      triangles.push({
        p1: new THREE.Vector3(v1x, v1y, v1z),
        p2: new THREE.Vector3(v2x, v2y, v2z),
        p3: new THREE.Vector3(v3x, v3y, v3z),
        normal: new THREE.Vector3(nx, ny, nz)
      });
    }
  }

  return {
    positions: new Float32Array(positionsArr),
    normals: new Float32Array(normalsArr),
    triangles
  };
}

/**
 * Main parser entry point: handles ArrayBuffer or string
 */
export function parseSTL(buffer: ArrayBuffer): ParsedSTL {
  const isAscii = isAsciiSTL(buffer);
  let parsed: { positions: Float32Array; normals: Float32Array; triangles: Triangle3D[] };

  if (isAscii) {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);
    parsed = parseAsciiSTL(text);
  } else {
    parsed = parseBinarySTL(buffer);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(parsed.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(parsed.normals, 3));

  // Compute normals if missing or zero
  if (parsed.normals.length === 0 || (parsed.normals[0] === 0 && parsed.normals[1] === 0 && parsed.normals[2] === 0)) {
    geometry.computeVertexNormals();
  }

  geometry.computeBoundingBox();
  const box = geometry.boundingBox || new THREE.Box3();
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  return {
    geometry,
    triangles: parsed.triangles,
    vertexCount: parsed.positions.length / 3,
    triangleCount: parsed.triangles.length,
    dimensions: { x: size.x, y: size.y, z: size.z },
    center: { x: center.x, y: center.y, z: center.z },
    isAscii
  };
}
