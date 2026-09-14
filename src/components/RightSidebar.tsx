import React, { useState } from 'react';
import {
  Layers,
  Clock,
  Scale,
  Download,
  DollarSign,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sliders,
  Play,
  Pause,
  Settings2,
  ShieldCheck,
  Gauge,
  Flame,
  GitBranch,
  Loader2,
  Printer
} from 'lucide-react';
import { SlicerSettings, SliceResult, PrinterProfile, MaterialProfile } from '../types';
import { PRINTER_COMPANIES, PRINTER_PROFILES, MATERIAL_PROFILES } from '../utils/presets';

interface RightSidebarProps {
  // Slicing Settings
  settings: SlicerSettings;
  onSettingsChange: (settings: SlicerSettings) => void;
  onResetDefaults: () => void;
  
  // Machine Config
  selectedPrinter: PrinterProfile;
  onPrinterChange: (printer: PrinterProfile) => void;
  selectedMaterial: MaterialProfile;
  onMaterialChange: (material: MaterialProfile) => void;
  
  // Toolpath Simulation
  sliceResult: SliceResult | null;
  activeLayer: number;
  onLayerChange: (layer: number) => void;
  showTravelMoves: boolean;
  onToggleTravelMoves: () => void;
  onDownloadGCode: () => void;
  
  // Slicing Action
  onSlice: () => void;
  isSlicing: boolean;
  sliceProgress: { percent: number; status: string };
  hasModel: boolean;
  
  // Sidebar State
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  settings,
  onSettingsChange,
  onResetDefaults,
  selectedPrinter,
  onPrinterChange,
  selectedMaterial,
  onMaterialChange,
  sliceResult,
  activeLayer,
  onLayerChange,
  showTravelMoves,
  onToggleTravelMoves,
  onDownloadGCode,
  onSlice,
  isSlicing,
  sliceProgress,
  hasModel,
  isCollapsed,
  onToggleCollapse
}) => {
  const [activeTab, setActiveTab] = useState<'quality' | 'walls' | 'infill' | 'supports' | 'speed' | 'material'>('quality');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    PRINTER_COMPANIES.find(c => c.printers.some(p => p.id === selectedPrinter.id))?.companyId || 'bambulab'
  );

  const currentCompanyObj = PRINTER_COMPANIES.find(c => c.companyId === selectedCompanyId) || PRINTER_COMPANIES[0];

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    const comp = PRINTER_COMPANIES.find(c => c.companyId === companyId);
    if (comp && comp.printers.length > 0) {
      if (companyId === 'bambulab') {
        const x1c = comp.printers.find(p => p.id === 'bambu-x1-carbon');
        onPrinterChange(x1c || comp.printers[0]);
      } else {
        onPrinterChange(comp.printers[0]);
      }
    }
  };

  const updateSetting = <K extends keyof SlicerSettings>(key: K, value: SlicerSettings[K]) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  // Animation Loop for toolpath
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && sliceResult && sliceResult.layers.length > 0) {
      const delay = Math.max(30, Math.round(150 / playSpeed));
      interval = setInterval(() => {
        onLayerChange(activeLayer >= sliceResult.layers.length ? 1 : activeLayer + 1);
      }, delay);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, activeLayer, playSpeed, sliceResult, onLayerChange]);

  const formatPrintTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${Math.max(1, mins)}m`;
  };

  return (
    <aside
      className={`relative h-full bg-[#11141a] border-l border-white/10 transition-all duration-300 flex flex-col overflow-hidden shadow-2xl z-40 ${
        isCollapsed ? 'w-12' : 'w-80'
      }`}
    >
      {/* Collapse Toggle Handle */}
      <button
        onClick={onToggleCollapse}
        className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-12 bg-[#11141a] border border-white/10 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-colors z-50 shadow-xl cursor-pointer"
      >
        {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Header */}
      <div className={`p-4 border-b border-white/10 flex items-center gap-3 bg-black/20 ${isCollapsed ? 'justify-center' : 'justify-end'}`}>
        {!isCollapsed && <h2 className="text-sm font-bold text-white tracking-tight uppercase text-right">Slicing & Simulation</h2>}
        <Settings2 className="w-5 h-5 text-cyan-400 shrink-0" />
      </div>

      {!isCollapsed && (
        <>
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {/* Machine Config Section */}
            <div className="p-4 border-b border-white/10 space-y-3 bg-black/20">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Printer className="w-3 h-3 text-cyan-400" />
                Machine Config
              </h3>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-lg border border-white/10">
                  <span className="text-[9px] text-gray-500 uppercase font-mono min-w-[40px] pl-1">Brand</span>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    className="flex-1 bg-transparent text-gray-300 font-medium text-[11px] focus:outline-none cursor-pointer"
                  >
                    {PRINTER_COMPANIES.map(c => (
                      <option key={c.companyId} value={c.companyId} className="bg-[#181a20] text-gray-200">
                        {c.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-lg border border-white/10">
                  <span className="text-[9px] text-gray-500 uppercase font-mono min-w-[40px] pl-1">Model</span>
                  <select
                    value={selectedPrinter.id}
                    onChange={(e) => {
                      const found = PRINTER_PROFILES.find(p => p.id === e.target.value);
                      if (found) onPrinterChange(found);
                    }}
                    className="flex-1 bg-transparent text-gray-300 font-medium text-[11px] focus:outline-none cursor-pointer truncate"
                  >
                    {currentCompanyObj.printers.map(p => (
                      <option key={p.id} value={p.id} className="bg-[#181a20] text-gray-200">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-lg border border-white/10">
                  <span className="text-[9px] text-gray-500 uppercase font-mono min-w-[40px] pl-1">Mat.</span>
                  <select
                    value={selectedMaterial.id}
                    onChange={(e) => {
                      const found = MATERIAL_PROFILES.find(m => m.id === e.target.value);
                      if (found) onMaterialChange(found);
                    }}
                    className="flex-1 bg-transparent text-amber-400 font-medium text-[11px] focus:outline-none cursor-pointer"
                  >
                    {MATERIAL_PROFILES.map(m => (
                      <option key={m.id} value={m.id} className="bg-[#181a20] text-gray-200">
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Slicing Tabs */}
            <div className="p-1.5 flex flex-wrap gap-1 bg-black/40 border-b border-white/10 sticky top-0 z-10 backdrop-blur-md">
              {[
                { id: 'quality', icon: Layers, label: 'Layers' },
                { id: 'walls', icon: ShieldCheck, label: 'Walls' },
                { id: 'infill', icon: Sliders, label: 'Infill' },
                { id: 'supports', icon: GitBranch, label: 'Support' },
                { id: 'speed', icon: Gauge, label: 'Speed' },
                { id: 'material', icon: Flame, label: 'Temps' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 min-w-[60px] flex flex-col items-center gap-1 py-1.5 rounded-lg transition-all border ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                      : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-bold uppercase tracking-tighter">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-4 space-y-4">
            {activeTab === 'quality' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                   <label className="text-xs text-gray-400 flex justify-between">
                     <span>Layer Height</span>
                     <span className="text-white font-mono">{settings.layerHeight} mm</span>
                   </label>
                   <div className="grid grid-cols-3 gap-2">
                     {[0.12, 0.20, 0.28].map(lh => (
                       <button
                         key={lh}
                         onClick={() => updateSetting('layerHeight', lh)}
                         className={`py-1.5 rounded border text-[11px] font-mono transition-all cursor-pointer ${
                           settings.layerHeight === lh 
                           ? 'bg-cyan-500 text-black border-cyan-400 font-bold' 
                           : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                         }`}
                       >
                         {lh}mm
                       </button>
                     ))}
                   </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 flex justify-between">
                    <span>First Layer Height</span>
                    <span className="text-white font-mono">{settings.firstLayerHeight} mm</span>
                  </label>
                  <input
                    type="range"
                    min="0.15"
                    max="0.35"
                    step="0.05"
                    value={settings.firstLayerHeight}
                    onChange={(e) => updateSetting('firstLayerHeight', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1 bg-white/15 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-xs text-gray-400 flex justify-between">
                    <span>Bed Adhesion</span>
                    <span className="capitalize text-cyan-400 font-mono">{settings.adhesionType}</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['none', 'skirt', 'brim'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => updateSetting('adhesionType', type)}
                        className={`py-1.5 rounded border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          settings.adhesionType === type
                            ? 'bg-cyan-500 text-black border-cyan-400'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'walls' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 flex justify-between">
                    <span>Wall Loops</span>
                    <span className="text-white font-mono">{settings.wallCount}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    value={settings.wallCount}
                    onChange={(e) => updateSetting('wallCount', parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 h-1 bg-white/15 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Top Layers</label>
                    <input
                      type="number"
                      value={settings.topSolidLayers}
                      onChange={(e) => updateSetting('topSolidLayers', parseInt(e.target.value, 10))}
                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Bottom Layers</label>
                    <input
                      type="number"
                      value={settings.bottomSolidLayers}
                      onChange={(e) => updateSetting('bottomSolidLayers', parseInt(e.target.value, 10))}
                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'infill' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 flex justify-between">
                    <span>Infill Density</span>
                    <span className="text-white font-mono">{settings.infillDensity}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.infillDensity}
                    onChange={(e) => updateSetting('infillDensity', parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 h-1 bg-white/15 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400">Pattern</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['grid', 'lines', 'triangles', 'gyroid'].map(p => (
                      <button
                        key={p}
                        onClick={() => updateSetting('infillPattern', p as any)}
                        className={`py-1.5 rounded border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          settings.infillPattern === p
                            ? 'bg-cyan-500 text-black border-cyan-400'
                            : 'bg-white/5 border-white/10 text-gray-400'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'supports' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <span className="text-xs font-bold text-white">Enable Supports</span>
                  <button
                    onClick={() => updateSetting('enableSupports', !settings.enableSupports)}
                    className={`w-10 h-5 rounded-full p-1 transition-colors ${settings.enableSupports ? 'bg-cyan-500' : 'bg-white/20'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${settings.enableSupports ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                
                {settings.enableSupports && (
                  <div className="space-y-3">
                    <label className="text-xs text-gray-400">Style</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'regular', label: 'Regular Pillars' },
                        { id: 'tree', label: 'Tree / Organic' },
                        { id: 'minimal_surface', label: 'Minimal Surface' }
                      ].map(s => (
                        <button
                          key={s.id}
                          onClick={() => updateSetting('supportStyle', s.id as any)}
                          className={`py-2 px-3 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${
                            settings.supportStyle === s.id
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                              : 'bg-white/5 border-white/10 text-gray-400'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'speed' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 flex justify-between">
                    <span>Print Speed</span>
                    <span className="text-white font-mono">{settings.perimeterSpeed} mm/s</span>
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="150"
                    value={settings.perimeterSpeed}
                    onChange={(e) => updateSetting('perimeterSpeed', parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 h-1 bg-white/15 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}

            {activeTab === 'material' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 flex justify-between">
                    <span>Hotend Temp</span>
                    <span className="text-amber-400 font-mono">{settings.hotendTemp} °C</span>
                  </label>
                  <input
                    type="range"
                    min="180"
                    max="300"
                    value={settings.hotendTemp}
                    onChange={(e) => updateSetting('hotendTemp', parseInt(e.target.value, 10))}
                    className="w-full accent-amber-500 h-1 bg-white/15 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Toolpath Simulation Section (Moved below tabs) */}
            {sliceResult && (
              <div className="mt-6 pt-6 border-t border-white/10 space-y-4 bg-cyan-500/[0.02] -mx-4 px-4 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Play className="w-3 h-3 text-cyan-400" />
                    Simulation
                  </h3>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    Layer {activeLayer} / {sliceResult.stats.totalLayers}
                  </span>
                </div>

                {/* Simulation Controls */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                    </button>

                    <input
                      type="range"
                      min="1"
                      max={sliceResult.stats.totalLayers}
                      value={activeLayer}
                      onChange={(e) => onLayerChange(parseInt(e.target.value, 10))}
                      className="flex-1 accent-cyan-400 cursor-pointer h-1 bg-white/15 rounded-lg"
                    />

                    <button
                      onClick={() => setPlaySpeed(playSpeed === 1 ? 2 : playSpeed === 2 ? 4 : 1)}
                      className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[9px] font-mono text-cyan-400 border border-white/10 transition-colors"
                    >
                      {playSpeed}x
                    </button>
                  </div>

                  {/* Legend & Visibility */}
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 max-w-[180px]">
                       <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#00d2ff]" /> Wall</span>
                       <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" /> Infill</span>
                       <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" /> Support</span>
                    </div>
                    <button
                      onClick={onToggleTravelMoves}
                      className="flex items-center gap-1 text-gray-500 hover:text-white transition-colors"
                    >
                      {showTravelMoves ? <Eye className="w-3 h-3 text-cyan-400" /> : <EyeOff className="w-3 h-3" />}
                      <span>Travel</span>
                    </button>
                  </div>

                  {/* Print Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col items-center">
                      <span className="text-[9px] text-gray-500 uppercase">Time</span>
                      <span className="text-xs font-bold text-white">{formatPrintTime(sliceResult.stats.estimatedTimeSeconds)}</span>
                    </div>
                    <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col items-center">
                      <span className="text-[9px] text-gray-500 uppercase">Weight</span>
                      <span className="text-xs font-bold text-white">{sliceResult.stats.totalFilamentWeightGrams.toFixed(1)}g</span>
                    </div>
                  </div>

                  <button
                    onClick={onDownloadGCode}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download G-Code
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Slicing Action Button - Fixed Bottom */}
          <div className="p-4 border-t border-white/10 bg-[#11141a]">
            <button
              id="main-slice-btn"
              disabled={!hasModel || isSlicing}
              onClick={onSlice}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                isSlicing
                  ? 'bg-amber-500 text-black cursor-wait shadow-amber-500/20'
                  : hasModel
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/25 active:scale-[0.98]'
                  : 'bg-white/10 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSlicing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Slicing ({sliceProgress.percent}%)</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-black" />
                  <span>Slice Model</span>
                </>
              )}
            </button>
          </div>
        </>
      )}
    </aside>
  );
};
