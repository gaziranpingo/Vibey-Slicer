import React, { useRef, useState } from 'react';
import {
  Layers,
  Box,
  FileCode2,
  Play,
  Download,
  FolderOpen,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Printer,
  Flame,
  CheckCircle2,
  Loader2,
  GitBranch
} from 'lucide-react';
import { AppViewMode, PrinterProfile, MaterialProfile, SliceResult } from '../types';
import { PRINTER_PROFILES, MATERIAL_PROFILES, PRINTER_COMPANIES } from '../utils/presets';

interface TopNavbarProps {
  viewMode: AppViewMode;
  onViewModeChange: (mode: AppViewMode) => void;
  sliceResult: SliceResult | null;
  onDownloadGCode: () => void;
  hasModel: boolean;
  currentUser: string | null;
  onLogout: () => void;
  slicingMode: 'client' | 'server';
  onSlicingModeChange: (mode: 'client' | 'server') => void;
  editingMode: 'client' | 'server';
  onEditingModeChange: (mode: 'client' | 'server') => void;
  showGhostMesh: boolean;
  onToggleGhostMesh: () => void;
  onSetCameraPreset: (preset: 'iso' | 'top' | 'front' | 'right') => void;
  onResetCamera: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  viewMode,
  onViewModeChange,
  sliceResult,
  onDownloadGCode,
  hasModel,
  currentUser,
  onLogout,
  slicingMode,
  onSlicingModeChange,
  editingMode,
  onEditingModeChange,
  showGhostMesh,
  onToggleGhostMesh,
  onSetCameraPreset,
  onResetCamera
}) => {
  return (
    <header
      id="desktop-top-navbar"
      className="h-14 w-full bg-[#14171d] border-b border-white/10 px-4 flex items-center justify-between z-30 select-none shadow-md relative"
    >
      {/* Left: Branding & App Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#1e2330] border border-white/10 flex items-center justify-center shadow-md shadow-cyan-500/10">
            <img src="/icon.svg" alt="Vibey Slicer Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5 leading-none">
                Vibey Slicer
              </div>
              <div className="text-[10px] text-gray-400 font-mono leading-none mt-1">
                The Vibecoded, Self-Hosted, Privacy Based Slicer
              </div>
            </div>

            {/* Vertically Stacked Engine Toggles */}
            <div className="flex flex-col gap-1 border-l border-white/10 pl-5">
               <div className="flex items-center gap-2">
                 <span className="text-[9px] uppercase font-bold text-gray-500 tracking-tight w-16">Slicer Engine</span>
                 <button
                   onClick={() => onSlicingModeChange(slicingMode === 'client' ? 'server' : 'client')}
                   className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer border ${
                     slicingMode === 'server' 
                       ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.1)]' 
                       : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.1)]'
                   }`}
                 >
                   {slicingMode === 'server' ? 'Server' : 'Client'}
                 </button>
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-[9px] uppercase font-bold text-gray-500 tracking-tight w-16">AI Optimizer</span>
                 <button
                   onClick={() => onEditingModeChange(editingMode === 'client' ? 'server' : 'client')}
                   className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer border ${
                     editingMode === 'server' 
                       ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.1)]' 
                       : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.1)]'
                   }`}
                 >
                   {editingMode === 'server' ? 'Server' : 'Client'}
                 </button>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle: Mode Switcher (Prepare, Preview, G-Code) */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10 shadow-inner">
        <button
          id="mode-prepare-btn"
          onClick={() => onViewModeChange('prepare')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'prepare'
              ? 'bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>Prepare</span>
        </button>

        <button
          id="mode-preview-btn"
          onClick={() => onViewModeChange('preview')}
          disabled={!sliceResult}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            viewMode === 'preview'
              ? 'bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Preview</span>
        </button>

        <button
          id="mode-gcode-btn"
          onClick={() => onViewModeChange('gcode')}
          disabled={!sliceResult}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            viewMode === 'gcode'
              ? 'bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5" />
          <span>G-Code</span>
        </button>
      </div>

      {/* Right: Camera Controls & User Profile */}
      <div className="flex items-center gap-2 pl-1">
        
        {/* Camera View Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-white/5 border border-white/10 mr-2">
          {viewMode === 'preview' && (
            <>
              <button
                id="toggle-ghost-mesh-btn"
                onClick={onToggleGhostMesh}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  showGhostMesh
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
                title="Toggle subtle reference model silhouette"
              >
                <Box className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Ghost Mesh: {showGhostMesh ? 'ON' : 'OFF'}</span>
              </button>
              <div className="h-3.5 w-[1px] bg-white/15 mx-0.5" />
            </>
          )}

          <button
            id="view-iso-btn"
            onClick={() => onSetCameraPreset('iso')}
            className="px-2.5 py-1 rounded text-[11px] font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Isometric View"
          >
            ISO
          </button>
          <button
            id="view-top-btn"
            onClick={() => onSetCameraPreset('top')}
            className="px-2.5 py-1 rounded text-[11px] font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Top View"
          >
            TOP
          </button>
          <button
            id="view-front-btn"
            onClick={() => onSetCameraPreset('front')}
            className="px-2.5 py-1 rounded text-[11px] font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Front View"
          >
            FRONT
          </button>
          <button
            id="view-right-btn"
            onClick={() => onSetCameraPreset('right')}
            className="px-2.5 py-1 rounded text-[11px] font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Right View"
          >
            RIGHT
          </button>

          <div className="h-3.5 w-[1px] bg-white/15 mx-0.5" />

          <button
            id="view-reset-btn"
            onClick={onResetCamera}
            className="p-1 rounded text-gray-400 hover:text-cyan-400 hover:bg-white/10 transition-colors cursor-pointer"
            title="Reset Camera & Center Target"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-col items-end hidden sm:flex">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-tighter">User</span>
          <span className="text-xs font-semibold text-cyan-400 leading-none">{currentUser}</span>
        </div>
        <button 
          onClick={onLogout}
          className="p-2 rounded-lg bg-white/5 hover:bg-red-500/10 border border-white/10 text-gray-400 hover:text-red-400 transition-all"
          title="Logout"
        >
          <FileCode2 className="w-4 h-4 rotate-90" />
        </button>
      </div>
    </header>
  );
};

