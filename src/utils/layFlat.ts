import * as THREE from 'three';

/**
 * Calculates the largest flat surface (bottom-most stable orientation)
 * by analyzing triangle normals and finding the optimal rotation matrix
 * to lay the model flat on the bed (Z = 0).
 */
export function calculateLayFlatRotation(geometry: THREE.BufferGeometry): THREE.Euler {
  const geom = geometry.clone();
  geom.computeVertexNormals();

  const posAttr = geom.attributes.position;
  const normAttr = geom.attributes.normal;

  if (!posAttr || !normAttr) {
    return new THREE.Euler(0, 0, 0);
  }

  // Collect candidate downward normals (pointing mostly downwards, i.e., -Z or close to it)
  // We sample face normals or vertex normals
  const candidateNormals: THREE.Vector3[] = [];
  const normal = new THREE.Vector3();

  for (let i = 0; i < normAttr.count; i++) {
    normal.set(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
    if (normal.lengthSq() > 0.5) {
      normal.normalize();
      candidateNormals.push(normal.clone());
    }
  }

  // If no good normals, return current
  if (candidateNormals.length === 0) {
    return new THREE.Euler(0, 0, 0);
  }

  // We want to find a normal n such that aligning -n with (0, 0, -1) [the build plate downward vector] 
  // places the largest flat area at the bottom.
  // Cluster or test prominent normals pointing downwards.
  // Let's test principal downward directions and face normals.
  
  // Find the lowest bounding box Z point after rotation for each candidate normal
  let bestQuaternion = new THREE.Quaternion();
  let maxStabilityScore = -1;

  // Test standard axis alignments and principal normal directions
  const testVectors = [
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(1, 0, 0)
  ];

  // Add a sample of geometry face normals pointing outwards
  for (let i = 0; i < Math.min(candidateNormals.length, 50); i += 2) {
    testVectors.push(candidateNormals[i].clone().negate());
  }

  const targetDown = new THREE.Vector3(0, 0, -1);
  const tempMatrix = new THREE.Matrix4();
  const testBox = new THREE.Box3();

  for (const v of testVectors) {
    if (v.lengthSq() === 0) continue;
    v.normalize();

    // Calculate rotation to align v with targetDown (0,0,-1)
    const q = new THREE.Quaternion().setFromUnitVectors(v, targetDown);
    tempMatrix.makeRotationFromQuaternion(q);

    // Test bounding box after rotation
    const clonedGeom = geom.clone();
    clonedGeom.applyMatrix4(tempMatrix);
    clonedGeom.computeBoundingBox();
    testBox.copy(clonedGeom.boundingBox!);

    const minZ = testBox.min.z;
    const sizeZ = testBox.max.z - testBox.min.z;
    const areaXY = (testBox.max.x - testBox.min.x) * (testBox.max.y - testBox.min.y);

    // Score: prefer stable flat base (large area near minZ = 0)
    // We want minZ close to 0 and good area
    const stabilityScore = areaXY / (Math.abs(minZ) + 1.0);

    if (stabilityScore > maxStabilityScore) {
      maxStabilityScore = stabilityScore;
      bestQuaternion.copy(q);
    }
  }

  const euler = new THREE.Euler().setFromQuaternion(bestQuaternion);
  return euler;
}
