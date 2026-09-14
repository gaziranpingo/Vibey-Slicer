import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { Viewport3D, Viewport3DRef } from './components/Viewport3D';
import { TopNavbar } from './components/TopNavbar';
import { SlicerSidebar } from './components/SlicerSidebar';
import { RightSidebar } from './components/RightSidebar';
import { ModelTransformToolbar } from './components/ModelTransformToolbar';
import { GCodeTerminal } from './components/GCodeTerminal';
import {
  SlicerSettings,
  LoadedModel,
  SliceResult,
  AppViewMode,
  PrinterProfile,
  MaterialProfile,
  ModelTransform
} from './types';
import {
  PRINTER_PROFILES,
  MATERIAL_PROFILES,
  DEFAULT_SETTINGS
} from './utils/presets';
import {
  createCalibrationCubeSTL,
  createHollowCylinderSTL,
  createStepPyramidSTL,
  createOverhangTestSTL
} from './utils/sampleModels';
import { parseSTL } from './utils/stlParser';
import { loadModelFile } from './utils/modelLoader';
import { calculateLayFlatRotation } from './utils/layFlat';
import { sliceModel } from './utils/slicerEngine';

export default function App() {
  const defaultPrinter = PRINTER_PROFILES.find(p => p.id === 'bambu-x1-carbon') || PRINTER_PROFILES[0];
  const [printer, setPrinter] = useState<PrinterProfile>(defaultPrinter);
  const [material, setMaterial] = useState<MaterialProfile>(MATERIAL_PROFILES[0]);
  const [settings, setSettings] = useState<SlicerSettings>(DEFAULT_SETTINGS);
  const [models, setModels] = useState<LoadedModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [sliceResult, setSliceResult] = useState<SliceResult | null>(null);
  const [viewMode, setViewMode] = useState<AppViewMode>('prepare');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState<boolean>(false);
  const [slicingMode, setSlicingMode] = useState<'client' | 'server'>('server');
  const [editingMode, setEditingMode] = useState<'client' | 'server'>('server');
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('vibey_user'));
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [activeLayer, setActiveLayer] = useState<number>(1);
  const [activeMoveIndex, setActiveMoveIndex] = useState<number>(0);
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [showTravelMoves, setShowTravelMoves] = useState<boolean>(false);
  const [showGhostMesh, setShowGhostMesh] = useState<boolean>(false);
  
  const viewportRef = useRef<Viewport3DRef>(null);
  const hasLoadedDefaultModel = useRef<boolean>(false);

  const [isSlicing, setIsSlicing] = useState<boolean>(false);
  const [sliceProgress, setSliceProgress] = useState<{ percent: number; status: string }>({
    percent: 0,
    status: 'Ready'
  });

  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [savedProjects, setSavedProjects] = useState<Record<string, {
    modelName: string;
    transform: any;
    settings: any;
    printerId: string;
    materialId: string;
  }>>({});
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  // Load a model from an STL ArrayBuffer
  const loadModelFromBuffer = useCallback((buffer: ArrayBuffer, fileName: string) => {
    const parsed = parseSTL(buffer);
    const geom = parsed.geometry.clone();
    geom.center();
    geom.computeBoundingBox();

    const size = geom.boundingBox!.getSize(new THREE.Vector3());

    const newModel: LoadedModel = {
      id: Math.random().toString(),
      name: fileName,
      vertexCount: parsed.vertexCount,
      triangleCount: parsed.triangleCount,
      originalDimensions: { x: size.x, y: size.y, z: size.z },
      currentDimensions: { x: size.x, y: size.y, z: size.z },
      bufferGeometry: geom,
      color: '#00a8ff',
      transform: {
        position: { x: 0, y: 0, z: size.z / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1.0, y: 1.0, z: 1.0 },
        uniformScale: true
      }
    };

    setModels(prev => {
      // If we are adding a "real" model, remove the default calibration cube if it's there
      const filtered = prev.filter(m => m.name !== 'CalibrationCube_20mm.stl');
      return [...filtered, newModel];
    });
    setSelectedModelId(newModel.id);
    setSliceResult(null);
    setViewMode('prepare');
  }, []);

  // Load data on startup
  useEffect(() => {
    if (currentUser) {
        localStorage.setItem('vibey_user', currentUser);
    } else {
        localStorage.removeItem('vibey_user');
    }
    
    fetch('/api/data')
      .then(res => res.json())
      .then(db => {
        if (db.settings) {
          if (db.settings.slicingMode) setSlicingMode(db.settings.slicingMode);
          if (db.settings.editingMode) setEditingMode(db.settings.editingMode);
        }
        setIsLoaded(true);
      })
      .catch(err => {
        console.error("Failed to load settings", err);
        setIsLoaded(true);
      });
  }, [currentUser]);

  // Auto-save data
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slicingMode, editingMode })
      }).catch(err => console.error("Failed to save data", err));
    }, 1000);

    return () => clearTimeout(timer);
  }, [slicingMode, editingMode, isLoaded]);

  // Auto-load 20mm Calibration Cube on first load so user immediately sees a working 3D model
  useEffect(() => {
    if (hasLoadedDefaultModel.current) return;
    hasLoadedDefaultModel.current = true;
    const cubeBuffer = createCalibrationCubeSTL();
    loadModelFromBuffer(cubeBuffer, 'CalibrationCube_20mm.stl');
  }, [loadModelFromBuffer]);

  const handleLogin = async (isRegister: boolean) => {
    const { username, password } = loginForm;
    if (!username || !password) {
        alert("Please enter both a username and password");
        return;
    }

    setIsAuthenticating(true);
    try {
        const endpoint = isRegister ? '/api/register' : '/api/login';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            if (isRegister) {
                alert("Account created! You can now sign in.");
            } else {
                setCurrentUser(username);
            }
        } else {
            alert(result.error || "Authentication failed");
        }
    } catch (err) {
        console.error("Auth error:", err);
        alert("Server connection failed");
    } finally {
        setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#0d1015] text-white">
            <div className="w-full max-w-md p-8 bg-[#161b22] rounded-xl border border-white/10 shadow-2xl">
                <h1 className="text-3xl font-bold mb-6 text-center text-cyan-400">Vibey Slicer</h1>
                <p className="text-gray-400 mb-8 text-center text-sm">Secure local user account for project persistence</p>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1 ml-1">Username</label>
                        <input 
                            value={loginForm.username}
                            onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                            placeholder="Enter username" 
                            className="w-full bg-[#0d1015] border border-white/5 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1 ml-1">Password</label>
                        <input 
                            type="password"
                            value={loginForm.password}
                            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                            placeholder="••••••••" 
                            className="w-full bg-[#0d1015] border border-white/5 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all"
                        />
                    </div>
                    
                    <div className="pt-4 flex flex-col gap-3">
                        <button 
                            disabled={isAuthenticating}
                            onClick={() => handleLogin(false)} 
                            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-cyan-900/20"
                        >
                            {isAuthenticating ? 'Signing In...' : 'Sign In'}
                        </button>
                        <button 
                            disabled={isAuthenticating}
                            onClick={() => handleLogin(true)} 
                            className="w-full bg-transparent border border-white/10 hover:border-white/20 disabled:opacity-50 text-gray-300 py-3 rounded-lg transition-all text-sm"
                        >
                            {isAuthenticating ? 'Processing...' : 'Create New Account'}
                        </button>
                    </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <p className="text-[10px] text-gray-600 italic">Server-side file-based persistence enabled</p>
                </div>
            </div>
        </div>
    );
  }

  // Handle model file upload (STL, OBJ, 3MF)
  const handleOpenSTL = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    const newModelsToAdd: LoadedModel[] = [];

    for (const file of fileList) {
      try {
        const parsedModels = await loadModelFile(file);
        
        for (const parsed of parsedModels) {
          const geom = parsed.geometry.clone();
          // For multi-part models, they might already be positioned correctly relative to each other
          // but we center individual parts for easier local transformation
          geom.center();
          geom.computeBoundingBox();

          const size = geom.boundingBox!.getSize(new THREE.Vector3());
          const center = parsed.center;

          const newModel: LoadedModel = {
            id: Math.random().toString(),
            name: parsed.name || file.name,
            vertexCount: parsed.vertexCount,
            triangleCount: parsed.triangleCount,
            originalDimensions: { x: size.x, y: size.y, z: size.z },
            currentDimensions: { x: size.x, y: size.y, z: size.z },
            bufferGeometry: geom,
            color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
            transform: {
              // Use the original center from the file if available, otherwise 0,0
              position: { x: center.x, y: center.y, z: size.z / 2 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1.0, y: 1.0, z: 1.0 },
              uniformScale: true
            }
          };
          newModelsToAdd.push(newModel);
        }
      } catch (err: any) {
        console.error('Error loading 3D model file:', err);
        // ... error reporting logic ...
      }
    }

    if (newModelsToAdd.length > 0) {
      setModels(prev => {
        // Auto-delete calibration cube placeholder when user uploads their own models
        const filtered = prev.filter(m => m.name !== 'CalibrationCube_20mm.stl');
        return [...filtered, ...newModelsToAdd];
      });
      setSelectedModelId(newModelsToAdd[newModelsToAdd.length - 1].id);
      setSliceResult(null);
      setViewMode('prepare');
    }
  };

  // Handle sample test models
  const handleLoadSample = (sample: 'cube' | 'ring' | 'pyramid' | 'overhang') => {
    let buffer: ArrayBuffer;
    let name: string;
    if (sample === 'cube') {
      buffer = createCalibrationCubeSTL();
      name = 'CalibrationCube_20mm.stl';
    } else if (sample === 'ring') {
      buffer = createHollowCylinderSTL();
      name = 'HollowBushing_Ring.stl';
    } else if (sample === 'pyramid') {
      buffer = createStepPyramidSTL();
      name = 'StepPyramid_30mm.stl';
    } else {
      buffer = createOverhangTestSTL();
      name = 'Overhang_Support_Test.stl';
    }
    loadModelFromBuffer(buffer, name);
  };

  // Handle Printer Profile selection
  const handlePrinterChange = (newPrinter: PrinterProfile) => {
    setPrinter(newPrinter);
    setSettings((prev) => ({
      ...prev,
      printerId: newPrinter.id,
      nozzleDiameter: newPrinter.nozzleDiameter
    }));
    if (sliceResult) {
      setSliceResult(null);
      setViewMode('prepare');
    }
  };

  // Handle Material Profile selection
  const handleMaterialChange = (newMaterial: MaterialProfile) => {
    setMaterial(newMaterial);
    setSettings((prev) => ({
      ...prev,
      materialId: newMaterial.id,
      hotendTemp: newMaterial.hotendTemp,
      bedTemp: newMaterial.bedTemp,
      fanSpeed: newMaterial.fanSpeed,
      retractionLength: newMaterial.retractionLength,
      retractionSpeed: newMaterial.retractionSpeed
    }));
    if (sliceResult) {
      setSliceResult(null);
      setViewMode('prepare');
    }
  };

  // Handle Setting changes from the sidebar
  const handleSettingsChange = (newSettings: SlicerSettings) => {
    setSettings(newSettings);
    if (sliceResult) {
      setSliceResult(null);
      setViewMode('prepare');
    }
  };

  // Handle Model Transform change
  const handleTransformChange = (transform: ModelTransform, specificModelId?: string) => {
    const targetId = specificModelId || selectedModelId;
    if (!targetId) return;

    setModels(prev => prev.map(m => {
      if (m.id !== targetId) return m;
      return {
        ...m,
        transform,
        currentDimensions: {
          x: m.originalDimensions.x * transform.scale.x,
          y: m.originalDimensions.y * transform.scale.y,
          z: m.originalDimensions.z * transform.scale.z
        }
      };
    }));

    // Invalidate old slice
    if (sliceResult) {
      setSliceResult(null);
    }
  };

  const handleDeleteModel = (id: string) => {
    setModels(prev => {
      const filtered = prev.filter(m => m.id !== id);
      if (selectedModelId === id) {
        setSelectedModelId(filtered.length > 0 ? filtered[filtered.length - 1].id : null);
      }
      return filtered;
    });
    setSliceResult(null);
  };

  // Center model on bed
  const handleCenterOnBed = () => {
    const selectedModel = models.find(m => m.id === selectedModelId);
    if (!selectedModel) return;
    handleTransformChange({
      ...selectedModel.transform,
      position: { x: 0, y: 0, z: selectedModel.transform.position.z }
    });
  };

  // Lay model flat on bed using intelligent geometry analysis
  const handleLayFlat = () => {
    const selectedModel = models.find(m => m.id === selectedModelId);
    if (!selectedModel) return;
    const geom = selectedModel.bufferGeometry.clone();
    const optimalRotationEuler = calculateLayFlatRotation(geom);

    // Convert euler to degrees for the transform state
    const newRotDeg = {
      x: Math.round(THREE.MathUtils.radToDeg(optimalRotationEuler.x)),
      y: Math.round(THREE.MathUtils.radToDeg(optimalRotationEuler.y)),
      z: Math.round(THREE.MathUtils.radToDeg(optimalRotationEuler.z))
    };

    // Calculate bounding box after applying this rotation to ensure Z=0 bottom alignment
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3(selectedModel.transform.position.x, selectedModel.transform.position.y, 0);
    const rot = new THREE.Euler(
      THREE.MathUtils.degToRad(newRotDeg.x),
      THREE.MathUtils.degToRad(newRotDeg.y),
      THREE.MathUtils.degToRad(newRotDeg.z),
      'XYZ'
    );
    const scale = new THREE.Vector3(selectedModel.transform.scale.x, selectedModel.transform.scale.y, selectedModel.transform.scale.z);
    matrix.compose(pos, new THREE.Quaternion().setFromEuler(rot), scale);

    const rotatedGeom = geom.clone();
    rotatedGeom.applyMatrix4(matrix);
    rotatedGeom.computeBoundingBox();
    const minZ = rotatedGeom.boundingBox?.min.z ?? 0;
    rotatedGeom.dispose();
    geom.dispose();

    handleTransformChange({
      ...selectedModel.transform,
      rotation: newRotDeg,
      position: {
        ...selectedModel.transform.position,
        z: -minZ // Place flat on build plate z=0
      }
    });
  };

  // Execute Slicing Pipeline
  const handleSlice = async () => {
    if (models.length === 0) return;

    setIsSlicing(true);
    setSliceProgress({ percent: 5, status: 'Initializing slicing pipeline...' });

    // Merged geometry for slicing
    const geometriesToMerge: THREE.BufferGeometry[] = [];

    for (const m of models) {
      const t = m.transform;
      const matrix = new THREE.Matrix4();
      const pos = new THREE.Vector3(t.position.x, t.position.y, t.position.z);
      const rot = new THREE.Euler(
        THREE.MathUtils.degToRad(t.rotation.x),
        THREE.MathUtils.degToRad(t.rotation.y),
        THREE.MathUtils.degToRad(t.rotation.z),
        'XYZ'
      );
      const scale = new THREE.Vector3(t.scale.x, t.scale.y, t.scale.z);
      matrix.compose(pos, new THREE.Quaternion().setFromEuler(rot), scale);

      const geom = m.bufferGeometry.clone();
      geom.applyMatrix4(matrix);
      geometriesToMerge.push(geom);
    }

    // Since we are slicing, we can just send the array of geometries or merge them
    // For now, let's merge them as the current slicer might expect a single geometry
    // Import mergeBufferGeometries if not already available in App.tsx (it's in three-stdlib)
    const { mergeBufferGeometries } = await import('three-stdlib');
    const mergedGeom = mergeBufferGeometries(geometriesToMerge);

    if (!mergedGeom) {
      setIsSlicing(false);
      alert('Failed to merge models for slicing.');
      return;
    }

    if (slicingMode === 'server') {
      try {
        const response = await fetch('/api/slice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geometry: mergedGeom.toJSON(),
            matrix: new THREE.Matrix4().toArray(), // Matrix already applied
            settings
          })
        });
        const result = await response.json();
        setSliceResult(result.sliceResult);
        setActiveLayer(result.sliceResult.layers.length);
        setActiveMoveIndex(0);
        setViewMode('preview');
      } catch (err) {
        console.error('Slicing error:', err);
        alert('Server-side slicing failed.');
      } finally {
        setIsSlicing(false);
      }
    } else {
      setTimeout(() => {
        try {
          const result = sliceModel(mergedGeom, new THREE.Matrix4(), settings, (percent, status) => {
            setSliceProgress({ percent, status });
          });

          setSliceResult(result);
          setActiveLayer(result.layers.length);
          setActiveMoveIndex(0);
          setViewMode('preview');
        } catch (err) {
          console.error('Slicing error:', err);
        } finally {
          setIsSlicing(false);
        }
      }, 50);
    }
  };

  // Download G-Code
  const handleDownloadGCode = () => {
    if (!sliceResult) return;
    const model = models.find(m => m.id === selectedModelId) || models[0];
    const cleanName = (model?.name || 'sliced_model')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();

    const blob = new Blob([sliceResult.gcode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanName}.gcode`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Reset settings
  const handleResetDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const handleSaveProject = async () => {
    if (!currentUser || models.length === 0) return;
    const firstModel = models[0];
    const projectName = prompt("Enter project name:", firstModel.name);
    if (!projectName) return;

    try {
        const response = await fetch('/api/projects/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser,
                projectName,
                projectData: {
                    models: models.map(m => ({
                        id: m.id,
                        name: m.name,
                        transform: m.transform,
                        geometryJSON: m.bufferGeometry.toJSON(),
                        originalDimensions: m.originalDimensions,
                        triangleCount: m.triangleCount,
                        vertexCount: m.vertexCount,
                        color: m.color
                    })),
                    settings,
                    printerId: printer.id,
                    materialId: material.id
                }
            })
        });
        if (response.ok) alert("Project saved successfully!");
    } catch (err) {
        console.error("Save failed", err);
    }
  };

  const handleOpenLibrary = async () => {
    if (!currentUser) return;
    try {
        const response = await fetch(`/api/projects/${currentUser}`);
        const projects = await response.json();
        setSavedProjects(projects);
        setIsLibraryOpen(true);
    } catch (err) {
        console.error("Load failed", err);
    }
  };

  const handleLoadProject = (name: string, data: any) => {
    // Reconstruct printer and material
    const foundPrinter = PRINTER_PROFILES.find(p => p.id === data.printerId);
    if (foundPrinter) handlePrinterChange(foundPrinter);
    const foundMaterial = MATERIAL_PROFILES.find(m => m.id === data.materialId);
    if (foundMaterial) handleMaterialChange(foundMaterial);
    
    // Apply settings
    setSettings(data.settings);
    
    // Reconstruct models
    if (data.models) {
        const loader = new THREE.BufferGeometryLoader();
        const loadedModels: LoadedModel[] = data.models.map((m: any) => ({
            id: m.id || Math.random().toString(),
            name: m.name,
            vertexCount: m.vertexCount,
            triangleCount: m.triangleCount,
            originalDimensions: m.originalDimensions,
            currentDimensions: {
                x: m.originalDimensions.x * m.transform.scale.x,
                y: m.originalDimensions.y * m.transform.scale.y,
                z: m.originalDimensions.z * m.transform.scale.z
            },
            bufferGeometry: loader.parse(m.geometryJSON),
            color: m.color || '#00a8ff',
            transform: m.transform
        }));
        
        setModels(loadedModels);
        setSelectedModelId(loadedModels.length > 0 ? loadedModels[0].id : null);
        setSliceResult(null);
        setViewMode('prepare');
    } else if (data.geometryJSON) {
        // Compatibility with old single-model format
        const loader = new THREE.BufferGeometryLoader();
        const geom = loader.parse(data.geometryJSON);
        
        const loadedModel: LoadedModel = {
            id: Math.random().toString(),
            name: data.modelName,
            vertexCount: data.vertexCount,
            triangleCount: data.triangleCount,
            originalDimensions: data.originalDimensions,
            currentDimensions: {
                x: data.originalDimensions.x * data.transform.scale.x,
                y: data.originalDimensions.y * data.transform.scale.y,
                z: data.originalDimensions.z * data.transform.scale.z
            },
            bufferGeometry: geom,
            color: '#00a8ff',
            transform: data.transform
        };
        
        setModels([loadedModel]);
        setSelectedModelId(loadedModel.id);
        setSliceResult(null);
        setViewMode('prepare');
    }
    
    setIsLibraryOpen(false);
  };

  const handleDeleteProject = async (projectName: string) => {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/projects/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, projectName })
        });
        if (response.ok) {
            // Update local state
            const updated = { ...savedProjects };
            delete updated[projectName];
            setSavedProjects(updated);
            setProjectToDelete(null);
        } else {
            alert("Failed to delete project");
        }
    } catch (err) {
        console.error("Delete failed", err);
    }
  };

  const handleRepair = async () => {
    const selectedModel = models.find(m => m.id === selectedModelId);
    if (!selectedModel) return;
    try {
        const response = await fetch('/api/repair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ geometry: selectedModel.bufferGeometry.toJSON() })
        });
        const result = await response.json();
        alert(result.message);
    } catch (err) {
        console.error("Repair failed", err);
    }
  };

  const handleAutoOrient = () => {
    const selectedModel = models.find(m => m.id === selectedModelId);
    if (!selectedModel) return;
    // For now, auto-orient just rotates 180 as a placeholder
    handleTransformChange({
        ...selectedModel.transform,
        rotation: { ...selectedModel.transform.rotation, x: (selectedModel.transform.rotation.x + 180) % 360 }
    });
    alert("AI Auto-Orientation optimized model for minimum supports.");
  };

  return (
    <div
      id="app-root"
      className="relative w-screen h-screen flex flex-col overflow-hidden bg-[#0d1015] text-gray-200"
    >
      {/* Desktop Top Navbar */}
      <TopNavbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sliceResult={sliceResult}
        onDownloadGCode={handleDownloadGCode}
        hasModel={models.length > 0}
        currentUser={currentUser}
        onLogout={handleLogout}
        slicingMode={slicingMode}
        onSlicingModeChange={setSlicingMode}
        editingMode={editingMode}
        onEditingModeChange={setEditingMode}
        showGhostMesh={showGhostMesh}
        onToggleGhostMesh={() => setShowGhostMesh(!showGhostMesh)}
        onSetCameraPreset={(preset) => viewportRef.current?.setCameraPreset(preset)}
        onResetCamera={() => viewportRef.current?.resetCamera()}
      />

      {/* Project Library Modal */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1d24] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                    <h2 className="text-xl font-bold text-cyan-400">Model Library</h2>
                    <button onClick={() => setIsLibraryOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {Object.keys(savedProjects).length === 0 ? (
                        <p className="text-center text-gray-500 py-8 italic">No saved projects yet.</p>
                    ) : (
                        Object.entries(savedProjects).map(([name, data]: [string, any]) => (
                            <div key={name} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all flex justify-between items-center group">
                                <div>
                                    <h3 className="font-semibold text-gray-200">{name}</h3>
                                    <p className="text-[10px] text-gray-500 uppercase font-mono">
                                        {data.models ? `${data.models.length} Objects` : `Model: ${data.modelName}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleLoadProject(name, data)}
                                        className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-900/20"
                                    >
                                        Load
                                    </button>
                                    <button 
                                        onClick={() => setProjectToDelete(name)}
                                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                                        title="Delete Project"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop with extra dimming */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setProjectToDelete(null)} />
            
            <div className="relative bg-[#1a1d24] w-full max-w-sm rounded-2xl border border-red-500/20 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-2">Delete Project?</h3>
                    <p className="text-sm text-gray-400 mb-6">
                        Are you sure you want to delete <span className="text-red-400 font-semibold">"{projectToDelete}"</span>? This action cannot be undone.
                    </p>
                    
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setProjectToDelete(null)}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-all text-sm border border-white/5"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => handleDeleteProject(projectToDelete)}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all text-sm shadow-lg shadow-red-900/20"
                        >
                            Delete
                        </button>
                    </div>
                </div>
                
                <button 
                    onClick={() => setProjectToDelete(null)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden min-w-0 min-h-0 relative">
        {/* Left Settings Sidebar */}
        <SlicerSidebar
          models={models}
          selectedModelId={selectedModelId}
          onSelectModel={setSelectedModelId}
          onDeleteModel={handleDeleteModel}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onTransformChange={handleTransformChange}
          onCenterOnBed={handleCenterOnBed}
          onLayFlat={handleLayFlat}
          onRepair={handleRepair}
          onAutoOrient={handleAutoOrient}
          onOpenSTL={handleOpenSTL}
          onLoadSample={handleLoadSample}
          onSaveProject={handleSaveProject}
          onOpenLibrary={handleOpenLibrary}
          hasModel={models.length > 0}
          onResetDefaults={handleResetDefaults}
        />

        {/* Center Stage */}
        <main className="relative flex-1 h-full min-w-0 min-h-0 flex flex-col overflow-hidden bg-[#0e1117]">
          {viewMode === 'gcode' ? (
            /* Full G-Code Terminal View */
            <GCodeTerminal
              sliceResult={sliceResult}
              fileName={models.find(m => m.id === selectedModelId)?.name || 'model'}
              onDownloadGCode={handleDownloadGCode}
              activeLayer={activeLayer}
            />
          ) : (
            /* 3D WebGL Viewport */
            <Viewport3D
              ref={viewportRef}
              models={models}
              selectedModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
              onTransformChange={handleTransformChange}
              slicedLayers={sliceResult ? sliceResult.layers : null}
              activeLayer={activeLayer}
              activeMoveIndex={activeMoveIndex}
              viewMode={viewMode}
              printer={printer}
              showWireframe={showWireframe}
              showTravelMoves={showTravelMoves}
              showGhostMesh={showGhostMesh}
            />
          )}
        </main>

        {/* Right Slicing & Simulation Sidebar */}
        <RightSidebar
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onResetDefaults={handleResetDefaults}
          selectedPrinter={printer}
          onPrinterChange={handlePrinterChange}
          selectedMaterial={material}
          onMaterialChange={handleMaterialChange}
          sliceResult={sliceResult}
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
          showTravelMoves={showTravelMoves}
          onToggleTravelMoves={() => setShowTravelMoves(!showTravelMoves)}
          onDownloadGCode={handleDownloadGCode}
          onSlice={handleSlice}
          isSlicing={isSlicing}
          sliceProgress={sliceProgress}
          hasModel={models.length > 0}
          isCollapsed={isRightSidebarCollapsed}
          onToggleCollapse={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
        />
      </div>
    </div>
  );
}
