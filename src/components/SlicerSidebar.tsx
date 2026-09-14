import React, { useState } from 'react';
import {
  Box,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Sliders,
  FolderOpen,
  Download,
  Layers,
  ChevronDown,
  Sparkles,
  RotateCcw,
  GitBranch,
  FileText
} from 'lucide-react';
import { LoadedModel, ModelTransform } from '../types';
import { ModelTransformToolbar } from './ModelTransformToolbar';

interface SlicerSidebarProps {
  models: LoadedModel[];
  selectedModelId: string | null;
  onSelectModel: (id: string | null) => void;
  onDeleteModel: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  
  // Transform props
  onTransformChange: (transform: ModelTransform) => void;
  onCenterOnBed: () => void;
  onLayFlat: () => void;
  onRepair: () => void;
  onAutoOrient: () => void;

  // File management props
  onOpenSTL: (files: FileList | File[]) => void;
  onLoadSample: (sample: 'cube' | 'ring' | 'pyramid' | 'overhang') => void;
  onSaveProject: () => void;
  onOpenLibrary: () => void;
  hasModel: boolean;
  onResetDefaults: () => void;
}

export const SlicerSidebar: React.FC<SlicerSidebarProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  onDeleteModel,
  isCollapsed,
  onToggleCollapse,
  onTransformChange,
  onCenterOnBed,
  onLayFlat,
  onRepair,
  onAutoOrient,
  onOpenSTL,
  onLoadSample,
  onSaveProject,
  onOpenLibrary,
  hasModel,
  onResetDefaults
}) => {
  const [showObjectsList, setShowObjectsList] = React.useState<boolean>(true);
  const [showTransform, setShowTransform] = React.useState<boolean>(true);
  const [showProject, setShowProject] = React.useState<boolean>(true);
  const [showSamples, setShowSamples] = React.useState<boolean>(false);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const selectedModel = models.find(m => m.id === selectedModelId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onOpenSTL(files);
    }
  };

  return (
    <aside
      id="slicer-settings-sidebar"
      className={`${
        isCollapsed ? 'w-12' : 'w-80'
      } relative flex flex-col h-full bg-[#11141a] border-r border-white/10 text-gray-200 select-none shadow-xl z-40 transition-all duration-300 overflow-hidden`}
    >
      {/* Collapse Toggle Handle (Floating) */}
      <button
        onClick={onToggleCollapse}
        className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-12 bg-[#11141a] border border-white/10 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-colors z-50 shadow-xl cursor-pointer"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Header */}
      <div className={`p-4 border-b border-white/10 flex items-center gap-3 bg-black/20 ${isCollapsed ? 'justify-center' : ''}`}>
        <Layers className="w-5 h-5 text-cyan-400 shrink-0" />
        {!isCollapsed && <h2 className="text-sm font-bold text-white tracking-tight uppercase">Project Workspace</h2>}
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Project / File Section */}
          <div className="flex flex-col border-b border-white/10 bg-black/20">
            <button 
              onClick={() => setShowProject(!showProject)}
              className="flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-gray-300 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>Project & Files</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showProject ? 'rotate-90' : ''}`} />
            </button>
            
            {showProject && (
              <div className="border-t border-white/5 bg-black/40 p-2 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".stl,.obj,.3mf"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-gray-300 hover:text-white group cursor-pointer"
                  >
                    <FolderOpen className="w-4 h-4 text-cyan-400" />
                    <span className="text-[10px] font-medium">Open Model</span>
                  </button>
                  <button
                    onClick={onSaveProject}
                    disabled={!hasModel}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-gray-300 hover:text-white group cursor-pointer disabled:opacity-40"
                  >
                    <Download className="w-4 h-4 text-emerald-400 rotate-180" />
                    <span className="text-[10px] font-medium">Save Project</span>
                  </button>
                  <button
                    onClick={onOpenLibrary}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-gray-300 hover:text-white group cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-medium">Library</span>
                  </button>
                  <button
                    onClick={() => setShowSamples(!showSamples)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all text-gray-300 hover:text-white group cursor-pointer ${showSamples ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-white/10'}`}
                  >
                    <Box className="w-4 h-4 text-purple-400" />
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-medium">Samples</span>
                      <ChevronDown className={`w-2.5 h-2.5 transition-transform ${showSamples ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                </div>

                {showSamples && (
                  <div className="grid grid-cols-1 gap-1 pt-1 border-t border-white/5">
                    {[
                      { id: 'cube', icon: Box, label: 'Calibration Cube', color: 'text-cyan-400' },
                      { id: 'ring', icon: RotateCcw, label: 'Bushing Ring', color: 'text-emerald-400' },
                      { id: 'pyramid', icon: Sparkles, label: 'Step Pyramid', color: 'text-amber-400' },
                      { id: 'overhang', icon: GitBranch, label: 'Overhang Test', color: 'text-purple-400' }
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => onLoadSample(s.id as any)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 text-[10px] text-gray-400 hover:text-white transition-all cursor-pointer"
                      >
                        <s.icon className={`w-3 h-3 ${s.color}`} />
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Objects List Section */}
          <div className="flex flex-col border-b border-white/10 bg-black/20">
            <button 
              onClick={() => setShowObjectsList(!showObjectsList)}
              className="flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-gray-300 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Box className="w-3.5 h-3.5 text-cyan-400" />
                <span>Scene Explorer ({models.length})</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showObjectsList ? 'rotate-90' : ''}`} />
            </button>
            
            {showObjectsList && (
              <div className="border-t border-white/5 bg-black/40 px-1 py-1 space-y-0.5">
                {models.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-gray-500 italic">
                    Empty build plate
                  </div>
                ) : (
                  models.map((m) => (
                    <div 
                      key={m.id}
                      onClick={() => onSelectModel(m.id)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer transition-all ${
                        selectedModelId === m.id 
                          ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-100' 
                          : 'hover:bg-white/5 text-gray-400 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="truncate text-[11px] font-medium">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteModel(m.id);
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Model Transform Section */}
          {selectedModel && (
            <div className="flex flex-col border-b border-white/10 bg-black/10">
              <button 
                onClick={() => setShowTransform(!showTransform)}
                className="flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-gray-300 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Object Transform</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showTransform ? 'rotate-90' : ''}`} />
              </button>

              {showTransform && (
                <div className="border-t border-white/5">
                  <ModelTransformToolbar
                    model={selectedModel}
                    onTransformChange={onTransformChange}
                    onCenterOnBed={onCenterOnBed}
                    onLayFlat={onLayFlat}
                    onRepair={onRepair}
                    onAutoOrient={onAutoOrient}
                  />
                </div>
              )}
            </div>
          )}

          {/* Selected Model Info Header Card */}
          {selectedModel && (
            <div className="flex flex-col border-t border-white/10 bg-black/20">
              <div className="px-3.5 py-2.5">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Mesh Statistics
                </h3>
              </div>
              
              <div className="p-3 pt-0 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 bg-black/30 px-2 py-1.5 rounded border border-white/5 shadow-inner">
                  <span className="shrink-0 mr-4">Name:</span>
                  <span className="text-cyan-300 font-bold truncate max-w-[150px] text-right" title={selectedModel.name}>
                    {selectedModel.name}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-500">
                  <div className="flex justify-between px-2 py-1.5 bg-black/20 rounded border border-white/5 shadow-inner">
                    <span>Tris:</span>
                    <span className="text-gray-300 font-bold">{selectedModel.triangleCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between px-2 py-1.5 bg-black/20 rounded border border-white/5 shadow-inner">
                    <span>Verts:</span>
                    <span className="text-gray-300 font-bold">{selectedModel.vertexCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className="p-3 border-t border-white/10 bg-black/30 flex items-center justify-between text-[10px]">
          <button
            onClick={onResetDefaults}
            className="text-gray-500 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
          <span className="text-gray-600 uppercase font-mono tracking-widest">Marlin v2.1</span>
        </div>
      )}
    </aside>
  );
};
