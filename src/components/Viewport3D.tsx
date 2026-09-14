import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SlicedLayer, LoadedModel, PrinterProfile, Segment2D, ModelTransform } from '../types';

import {
  Compass,
  Eye,
  Maximize2,
  Grid,
  RotateCcw,
  Sparkles,
  Layers,
  Box,
  Sliders
} from 'lucide-react';

interface Viewport3DProps {
  models: LoadedModel[];
  selectedModelId: string | null;
  onSelectModel?: (id: string | null) => void;
  onTransformChange?: (transform: ModelTransform, specificModelId?: string) => void;
  slicedLayers: SlicedLayer[] | null;
  activeLayer: number;
  activeMoveIndex?: number;
  viewMode: 'prepare' | 'preview' | 'gcode';
  printer: PrinterProfile;
  showWireframe: boolean;
  showTravelMoves: boolean;
  showGhostMesh: boolean;
  onResetCamera?: () => void;
}

export interface Viewport3DRef {
  setCameraPreset: (preset: 'iso' | 'top' | 'front' | 'right') => void;
  resetCamera: () => void;
}

export const Viewport3D = forwardRef<Viewport3DRef, Viewport3DProps>(({
  models,
  selectedModelId,
  onSelectModel,
  onTransformChange,
  slicedLayers,
  activeLayer,
  activeMoveIndex,
  viewMode,
  printer,
  showWireframe,
  showTravelMoves,
  showGhostMesh
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const toolpathGroupRef = useRef<THREE.Group | null>(null);
  const nozzleRef = useRef<THREE.Mesh | null>(null);
  const bedGroupRef = useRef<THREE.Group | null>(null);

  const [currentViewName, setCurrentViewName] = useState<string>('3D Isometric');

  const propsRef = useRef({ models, selectedModelId, onSelectModel, onTransformChange, viewMode });
  useEffect(() => {
    propsRef.current = { models, selectedModelId, onSelectModel, onTransformChange, viewMode };
  }, [models, selectedModelId, onSelectModel, onTransformChange, viewMode]);

  useImperativeHandle(ref, () => ({
    setCameraPreset,
    resetCamera: handleResetCamera
  }));

  // Initialize Three.js Scene and Renderer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1117);
    sceneRef.current = scene;

    // Create Camera (Z-Up)
    const initialWidth = Math.max(container.clientWidth, 100);
    const initialHeight = Math.max(container.clientHeight, 100);
    const camera = new THREE.PerspectiveCamera(42, initialWidth / initialHeight, 0.5, 4000);
    camera.up.set(0, 0, 1); // Native 3D printing Z-UP
    camera.position.set(160, -220, 160);
    cameraRef.current = camera;

    // Create Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initialWidth, initialHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Remove any leftover canvas from hot-reloads
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 5;
    controls.maxDistance = 2500;
    controls.maxPolarAngle = Math.PI / 2 + 0.15; // slightly below bed
    controls.target.set(0, 0, 15);
    controls.update();
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(150, -180, 260);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 10;
    mainLight.shadow.camera.far = 800;
    const shadowDist = 180;
    mainLight.shadow.camera.left = -shadowDist;
    mainLight.shadow.camera.right = shadowDist;
    mainLight.shadow.camera.top = shadowDist;
    mainLight.shadow.camera.bottom = -shadowDist;
    mainLight.shadow.bias = -0.0005;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x7090ff, 0.45);
    fillLight.position.set(-180, 150, 100);
    scene.add(fillLight);

    const bottomBounceLight = new THREE.DirectionalLight(0x223344, 0.3);
    bottomBounceLight.position.set(0, 0, -100);
    scene.add(bottomBounceLight);

    // Bed Group
    const bedGroup = new THREE.Group();
    scene.add(bedGroup);
    bedGroupRef.current = bedGroup;

    // Toolpath Group
    const toolpathGroup = new THREE.Group();
    scene.add(toolpathGroup);
    toolpathGroupRef.current = toolpathGroup;

    // Virtual Nozzle Indicator (small cone pointing down at current extrusion point)
    const nozzleGeom = new THREE.ConeGeometry(2, 6, 16);
    nozzleGeom.rotateX(-Math.PI / 2); // Point down towards -Z (bed plate)
    nozzleGeom.translate(0, 0, 3);
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x664400
    });
    const nozzleMesh = new THREE.Mesh(nozzleGeom, nozzleMat);
    nozzleMesh.visible = false;
    scene.add(nozzleMesh);
    nozzleRef.current = nozzleMesh;

    // Raycaster & Dragging Logic
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let draggingModelId: string | null = null;
    let dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    let dragOffset = new THREE.Vector3();
    let isDragging = false;

    const getIntersects = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(modelMeshesRef.current.values()) as THREE.Mesh[];
      return raycaster.intersectObjects(meshes, false);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (propsRef.current.viewMode !== 'prepare') return;
      if (event.button !== 0) return;

      const intersects = getIntersects(event);
      if (intersects.length > 0) {
        const hit = intersects[0];
        const entries = Array.from(modelMeshesRef.current.entries());
        const entry = entries.find(([id, mesh]) => mesh === hit.object);
        if (entry) {
          const modelId = entry[0];
          draggingModelId = modelId;
          isDragging = false; // Will set to true on move

          if (propsRef.current.selectedModelId !== modelId && propsRef.current.onSelectModel) {
             propsRef.current.onSelectModel(modelId);
          }

          controls.enabled = false;

          const modelInfo = propsRef.current.models.find(m => m.id === modelId);
          if (modelInfo) {
            dragPlane.setComponents(0, 0, 1, -modelInfo.transform.position.z);
            const intersection = new THREE.Vector3();
            const hitPlane = raycaster.ray.intersectPlane(dragPlane, intersection);
            if (hitPlane) {
              dragOffset.set(
                modelInfo.transform.position.x,
                modelInfo.transform.position.y,
                modelInfo.transform.position.z
              ).sub(intersection);
            }
          }
        }
      } else {
        if (propsRef.current.selectedModelId && propsRef.current.onSelectModel) {
            propsRef.current.onSelectModel(null);
        }
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!draggingModelId) return;

      isDragging = true;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const intersection = new THREE.Vector3();
      const hitPlane = raycaster.ray.intersectPlane(dragPlane, intersection);

      if (hitPlane) {
        const newPos = intersection.add(dragOffset);
        const mesh = modelMeshesRef.current.get(draggingModelId);
        if (mesh) {
          mesh.position.set(newPos.x, newPos.y, newPos.z);
        }
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (draggingModelId) {
        if (isDragging) {
          const mesh = modelMeshesRef.current.get(draggingModelId);
          const modelInfo = propsRef.current.models.find(m => m.id === draggingModelId);
          
          if (mesh && modelInfo && propsRef.current.onTransformChange) {
             propsRef.current.onTransformChange({
               ...modelInfo.transform,
               position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z }
             }, draggingModelId);
          }
        }
        
        draggingModelId = null;
        isDragging = false;
        controls.enabled = true;
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('pointerleave', onPointerUp);

    // Animation Loop
    let animFrameId = 0;
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Robust ResizeObserver: handles flexbox sizing, window resize, tab switching
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(width, height, true);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('pointerleave', onPointerUp);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Bed Build Plate whenever printer profile changes
  useEffect(() => {
    const bedGroup = bedGroupRef.current;
    if (!bedGroup) return;

    // Clear previous bed
    while (bedGroup.children.length > 0) {
      const child = bedGroup.children[0] as THREE.Mesh;
      bedGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }

    const { bedWidth, bedDepth, maxHeight } = printer;
    const halfW = bedWidth / 2;
    const halfD = bedDepth / 2;

    // 1. Bed Surface Plate (Textured PEI look)
    const plateGeom = new THREE.BoxGeometry(bedWidth, bedDepth, 2);
    plateGeom.translate(0, 0, -1);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.85,
      metalness: 0.2
    });
    const plateMesh = new THREE.Mesh(plateGeom, plateMat);
    plateMesh.receiveShadow = true;
    bedGroup.add(plateMesh);

    // 2. Grid lines
    const divisions = Math.floor(bedWidth / 10);
    const step = bedWidth / divisions;
    const gridPositions: number[] = [];
    const gridColors: number[] = [];

    const cMajor = new THREE.Color(0x38bdf8);
    const cMinor = new THREE.Color(0x232936);
    const cBorder = new THREE.Color(0x3b82f6);

    for (let i = 0; i <= divisions; i++) {
      const x = -halfW + i * step;
      const isCenter = Math.abs(x) < 1e-4;
      const col = isCenter ? cMajor : cMinor;

      // Parallel to Y
      gridPositions.push(x, -halfD, 0.05, x, halfD, 0.05);
      gridColors.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }

    const divisionsY = Math.floor(bedDepth / 10);
    const stepY = bedDepth / divisionsY;
    for (let j = 0; j <= divisionsY; j++) {
      const y = -halfD + j * stepY;
      const isCenter = Math.abs(y) < 1e-4;
      const col = isCenter ? cMajor : cMinor;

      // Parallel to X
      gridPositions.push(-halfW, y, 0.05, halfW, y, 0.05);
      gridColors.push(col.r, col.g, col.b, col.r, col.g, col.b);
    }

    const gridGeom = new THREE.BufferGeometry();
    gridGeom.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
    gridGeom.setAttribute('color', new THREE.Float32BufferAttribute(gridColors, 3));
    const gridMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
    bedGroup.add(new THREE.LineSegments(gridGeom, gridMat));

    // 3. Bed Outer Border Glow
    const borderGeom = new THREE.BufferGeometry();
    const bVerts = [
      -halfW, -halfD, 0.1,  halfW, -halfD, 0.1,
       halfW, -halfD, 0.1,  halfW,  halfD, 0.1,
       halfW,  halfD, 0.1, -halfW,  halfD, 0.1,
      -halfW,  halfD, 0.1, -halfW, -halfD, 0.1
    ];
    borderGeom.setAttribute('position', new THREE.Float32BufferAttribute(bVerts, 3));
    const borderMat = new THREE.LineBasicMaterial({ color: 0x0ea5e9, linewidth: 2 });
    bedGroup.add(new THREE.LineSegments(borderGeom, borderMat));

    // 4. Build Volume Bounding Box (semi-transparent cage)
    const cageGeom = new THREE.BoxGeometry(bedWidth, bedDepth, maxHeight);
    cageGeom.translate(0, 0, maxHeight / 2);
    const edgesGeom = new THREE.EdgesGeometry(cageGeom);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.4 });
    bedGroup.add(new THREE.LineSegments(edgesGeom, edgesMat));
  }, [printer]);

  // Update 3D Model Meshes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear removed models
    const currentModelIds = new Set(models.map(m => m.id));
    for (const [id, mesh] of modelMeshesRef.current.entries()) {
      if (!currentModelIds.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
        modelMeshesRef.current.delete(id);
      }
    }

    // Add or update models
    models.forEach((model) => {
      let mesh = modelMeshesRef.current.get(model.id);
      
      const isSelected = model.id === selectedModelId;
      const t = model.transform;
      const color = new THREE.Color(model.color || '#00a8ff');

      if (!mesh) {
        const geom = model.bufferGeometry.clone();
        const material = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.35,
          metalness: 0.15,
          wireframe: showWireframe,
          side: THREE.DoubleSide,
          transparent: viewMode === 'preview',
          opacity: viewMode === 'preview' ? (showGhostMesh ? 0.08 : 0) : 1.0,
          depthWrite: viewMode === 'prepare'
        });

        mesh = new THREE.Mesh(geom, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        modelMeshesRef.current.set(model.id, mesh);
      } else {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.wireframe = showWireframe;
        
        if (viewMode === 'prepare') {
          mesh.visible = true;
          mat.transparent = false;
          mat.opacity = 1.0;
          mat.depthWrite = true;
          mat.color.copy(color);
          
          // Highlight selected model
          if (isSelected) {
            mat.emissive.setHex(0x112233);
            mat.emissiveIntensity = 0.5;
          } else {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        } else if (viewMode === 'preview') {
          if (showGhostMesh) {
            mesh.visible = true;
            mat.transparent = true;
            mat.opacity = 0.08;
            mat.depthWrite = false;
            mat.color.setHex(0xa1a1aa);
          } else {
            mesh.visible = false;
          }
        } else {
          // If not in preview, treat as prepare (visible)
          mesh.visible = true;
          mat.transparent = false;
          mat.opacity = 1.0;
          mat.depthWrite = true;
          mat.color.copy(color);
        }
      }

      // Apply transform (Position, Rotation, Scale)
      mesh.position.set(t.position.x, t.position.y, t.position.z);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(t.rotation.x),
        THREE.MathUtils.degToRad(t.rotation.y),
        THREE.MathUtils.degToRad(t.rotation.z)
      );
      mesh.scale.set(t.scale.x, t.scale.y, t.scale.z);
    });
  }, [models, selectedModelId, showWireframe, viewMode, showGhostMesh]);

  // Combined Visibility Effect is now merged into the above effect for multi-model logic

  // Update Toolpaths (Batched 60FPS LineSegments per layer)
  useEffect(() => {
    const group = toolpathGroupRef.current;
    if (!group) return;

    // Clear existing toolpaths
    while (group.children.length > 0) {
      const c = group.children[0] as THREE.LineSegments;
      group.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) (c.material as THREE.Material).dispose();
    }

    if (!slicedLayers || slicedLayers.length === 0 || viewMode === 'prepare') {
      group.visible = false;
      return;
    }

    group.visible = true;

    // Color definitions
    const cOuterWall = new THREE.Color(0x00d2ff);  // Bright Cyan
    const cInnerWall = new THREE.Color(0x2563eb);  // Royal Blue
    const cSolidInfill = new THREE.Color(0xf59e0b); // Amber / Yellow
    const cSparseInfill = new THREE.Color(0x10b981); // Emerald Green
    const cSkirt = new THREE.Color(0xf97316);      // Bright Orange
    const cSupport = new THREE.Color(0xa855f7);    // Vivid Purple / Violet
    const cSupportInterface = new THREE.Color(0xec4899); // Pink / Magenta
    const cTravel = new THREE.Color(0x94a3b8);     // Light Slate

    slicedLayers.forEach((layer, layerIdx) => {
      const positions: number[] = [];
      const colors: number[] = [];

      for (const seg of layer.segments) {
        if (seg.type === 'travel' && !showTravelMoves) continue;

        positions.push(seg.a.x, seg.a.y, layer.z);
        positions.push(seg.b.x, seg.b.y, layer.z);

        let col = cOuterWall;
        if (seg.type === 'inner_wall') col = cInnerWall;
        else if (seg.type === 'solid_infill') col = cSolidInfill;
        else if (seg.type === 'sparse_infill') col = cSparseInfill;
        else if (seg.type === 'support') col = cSupport;
        else if (seg.type === 'support_interface') col = cSupportInterface;
        else if (seg.type === 'skirt') col = cSkirt;
        else if (seg.type === 'travel') col = cTravel;

        colors.push(col.r, col.g, col.b);
        colors.push(col.r, col.g, col.b);
      }

      if (positions.length === 0) return;

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: false,
        depthTest: true,
        depthWrite: true
      });

      const lineSegs = new THREE.LineSegments(geom, mat);
      lineSegs.userData = { layerIdx };
      lineSegs.visible = layerIdx < activeLayer;
      group.add(lineSegs);
    });
  }, [slicedLayers, viewMode, showTravelMoves]);

  // Update Layer Filter and active nozzle indicator
  useEffect(() => {
    const group = toolpathGroupRef.current;
    if (!group) return;

    group.children.forEach((child) => {
      const lIdx = (child.userData as { layerIdx?: number })?.layerIdx ?? 0;
      const isVisible = lIdx < activeLayer;
      child.visible = isVisible;
      if (isVisible) {
        const mat = (child as THREE.LineSegments).material as THREE.LineBasicMaterial;
        if (mat) {
          if (lIdx === activeLayer - 1) {
            mat.color.setHex(0xffffff); // Full brilliant contrast for current top layer
          } else {
            mat.color.setHex(0xd0d4dc); // Crisp shaded base layers with full depth occlusion
          }
        }
      }
    });

    // Update nozzle position
    if (nozzleRef.current && slicedLayers && slicedLayers.length > 0) {
      const currentLayer = slicedLayers[activeLayer - 1];
      if (currentLayer && currentLayer.segments.length > 0) {
        const segIdx = activeMoveIndex !== undefined
          ? Math.min(activeMoveIndex, currentLayer.segments.length - 1)
          : currentLayer.segments.length - 1;
        const pt = currentLayer.segments[segIdx]?.b || currentLayer.segments[0].a;
        nozzleRef.current.position.set(pt.x, pt.y, currentLayer.z);
        nozzleRef.current.visible = viewMode === 'preview';
      } else {
        nozzleRef.current.visible = false;
      }
    }
  }, [activeLayer, activeMoveIndex, slicedLayers, viewMode]);

  // Camera Presets
  const setCameraPreset = (preset: 'iso' | 'top' | 'front' | 'right') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const target = controls.target;

    const dist = 240;

    if (preset === 'iso') {
      camera.position.set(target.x + dist * 0.7, target.y - dist * 0.8, target.z + dist * 0.65);
      setCurrentViewName('3D Isometric');
    } else if (preset === 'top') {
      camera.position.set(target.x, target.y + 0.001, target.z + dist * 1.3);
      setCurrentViewName('Top View (X-Y)');
    } else if (preset === 'front') {
      camera.position.set(target.x, target.y - dist * 1.2, target.z + 10);
      setCurrentViewName('Front View (X-Z)');
    } else if (preset === 'right') {
      camera.position.set(target.x + dist * 1.2, target.y, target.z + 10);
      setCurrentViewName('Right View (Y-Z)');
    }

    camera.lookAt(target);
    controls.update();
  };

  const handleResetCamera = () => {
    setCameraPreset('iso');
  };

  return (
    <div
      id="viewport-wrapper"
      className="relative w-full h-full flex-1 min-w-0 min-h-0 overflow-hidden bg-[#0e1117] select-none"
    >
      {/* 3D WebGL Canvas Container */}
      <div
        id="threejs-canvas-container"
        ref={containerRef}
        className="w-full h-full block"
      />

      {/* Axis Helper Mini-Indicator (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-gray-300">
        <span className="text-rose-400 font-bold">X (Width)</span>
        <span className="text-emerald-400 font-bold">Y (Depth)</span>
        <span className="text-cyan-400 font-bold">Z (Height)</span>
      </div>
    </div>
  );
});
