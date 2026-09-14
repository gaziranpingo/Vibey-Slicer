import * as THREE from 'three';
import { OBJLoader, STLLoader, mergeBufferGeometries } from 'three-stdlib';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import * as fflate from 'fflate';
import { parseSTL, ParsedSTL } from './stlParser';

/**
 * Universal 3D Model Loader (supports STL, OBJ, and 3MF)
 */
export async function loadModelFile(file: File): Promise<ParsedSTL[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  
  // Check for ZIP magic number (3MF is a ZIP)
  const header = new Uint8Array(arrayBuffer.slice(0, 4));
  const isZip = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
  
  console.log(`Attempting to load file: ${file.name} (${file.size} bytes, ext: ${extension}, isZip: ${isZip})`);

  try {
    if (extension === 'obj') {
      const textDecoder = new TextDecoder('utf-8');
      const objText = textDecoder.decode(arrayBuffer);
      const objLoader = new OBJLoader();
      try {
        const object = objLoader.parse(objText);
        return processLoadedObjectToMultiple(object, file.name);
      } catch (objErr: any) {
        throw new Error(`OBJ Parser Error: ${objErr.message}`);
      }
    } else if (extension === '3mf' || isZip) {
      const loader = new ThreeMFLoader();
      // Ensure fflate is set if the loader supports it
      if ((loader as any).setFflate) {
        (loader as any).setFflate(fflate);
      }
      
      const blob = new Blob([arrayBuffer]);
      const url = URL.createObjectURL(blob);
      try {
        const object = await new Promise<THREE.Group>((resolve, reject) => {
          loader.load(url, resolve, undefined, (err: any) => {
            console.error("3MF Loader Error callback:", err);
            reject(new Error(err?.message || 'Failed to parse 3MF file.'));
          });
        });
        return processLoadedObjectToMultiple(object, file.name);
      } catch (mfErr: any) {
        console.error("3MF Load Error:", mfErr);
        throw new Error(`3MF Parser Error: ${mfErr.message}`);
      } finally {
        URL.revokeObjectURL(url);
      }
    } else if (extension === 'stl') {
      const loader = new STLLoader();
      const blob = new Blob([arrayBuffer]);
      const url = URL.createObjectURL(blob);
      try {
        const geometry = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });
        return [processLoadedGeometry(geometry, file.name)];
      } catch (stlErr: any) {
        console.error("STL Load Error:", stlErr);
        // Fallback to manual parser if STLLoader fails
        return [parseSTL(arrayBuffer)];
      } finally {
        URL.revokeObjectURL(url);
      }
    } else {
      // Fallback for unknown extensions
      try {
        return [parseSTL(arrayBuffer)];
      } catch (e) {
        throw new Error('Unsupported or malformed 3D model file format.');
      }
    }
  } catch (err: any) {
    console.error(`Detailed loading error for ${extension}:`, err);
    
    // Safety check for memory-heavy fallbacks
    if (isZip) {
        throw new Error(`${err.message} (Note: This compressed 3MF file might be using unsupported features)`);
    }

    // Attempt legacy fallback only for non-STL files that failed their primary loader
    if (extension !== 'stl') {
      console.log(`Attempting legacy STL fallback for ${extension} file...`);
      try {
        return [parseSTL(arrayBuffer)];
      } catch (fallbackErr: any) {
        console.error("STL Fallback failed:", fallbackErr);
        throw new Error(`${err.message} (Legacy fallback also failed: ${fallbackErr.message})`);
      }
    }
    throw err;
  }
}

/**
 * Process a single BufferGeometry into the ParsedSTL format
 */
function processLoadedGeometry(geometry: THREE.BufferGeometry, name: string): ParsedSTL {
    let finalGeom = geometry;
    if (finalGeom.index) {
        finalGeom = finalGeom.toNonIndexed();
    }
    
    finalGeom.computeVertexNormals();
    finalGeom.computeBoundingBox();
    const box = finalGeom.boundingBox || new THREE.Box3();
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const posAttr = finalGeom.attributes.position;
    const vertexCount = posAttr ? posAttr.count : 0;
    const triangleCount = vertexCount / 3;

    return {
        geometry: finalGeom,
        name: name, // Added name field to ParsedSTL if needed or handle separately
        triangles: [],
        vertexCount,
        triangleCount,
        dimensions: { x: size.x, y: size.y, z: size.z },
        center: { x: center.x, y: center.y, z: center.z },
        isAscii: false
    };
}

/**
 * Processes Object3D results from loaders into multiple ParsedSTL objects
 */
function processLoadedObjectToMultiple(object: THREE.Object3D, fileName: string): ParsedSTL[] {
  const results: ParsedSTL[] = [];
  let meshCounter = 1;

  object.updateMatrixWorld(true);
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      let geom = mesh.geometry.clone();
      
      if (geom && geom.attributes.position) {
        if (geom.index) {
          geom = geom.toNonIndexed();
        }
        
        // Apply world matrix to get global position
        geom.applyMatrix4(mesh.matrixWorld);
        
        geom.computeVertexNormals();
        geom.computeBoundingBox();
        const box = geom.boundingBox || new THREE.Box3();
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const posAttr = geom.attributes.position;
        const vertexCount = posAttr ? posAttr.count : 0;
        const triangleCount = vertexCount / 3;

        results.push({
          geometry: geom,
          name: mesh.name || `${fileName} (Mesh ${meshCounter++})`,
          triangles: [],
          vertexCount,
          triangleCount,
          dimensions: { x: size.x, y: size.y, z: size.z },
          center: { x: center.x, y: center.y, z: center.z },
          isAscii: false
        });
      }
    }
  });

  if (results.length === 0) {
    throw new Error('No mesh data found in the model file scene.');
  }

  return results;
}
