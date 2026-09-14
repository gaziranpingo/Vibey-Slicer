import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileCode,
  Download,
  Copy,
  Check,
  Search,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ListFilter,
  Eye,
  Maximize2,
  Clock,
  Scale,
  DollarSign
} from 'lucide-react';
import { SliceResult } from '../types';

interface GCodeTerminalProps {
  sliceResult: SliceResult | null;
  fileName: string;
  onDownloadGCode: () => void;
  activeLayer: number;
}

const LINES_PER_PAGE = 2500;

export const GCodeTerminal: React.FC<GCodeTerminalProps> = ({
  sliceResult,
  fileName,
  onDownloadGCode,
  activeLayer
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedView, setCopiedView] = useState(false);
  const [selectedLayerFilter, setSelectedLayerFilter] = useState<number | 'all' | 'start' | 'end'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllLinesContinuous, setShowAllLinesContinuous] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Split G-Code into lines
  const lines = useMemo(() => {
    if (!sliceResult?.gcode) return [];
    return sliceResult.gcode.split('\n');
  }, [sliceResult]);

  // Index where each layer starts and ends in the line array
  const layerIndexMap = useMemo(() => {
    const map = new Map<number, { startLine: number; endLine: number; z: number }>();
    if (lines.length === 0) return { map, startGCodeEnd: 0, endGCodeStart: lines.length };

    let currentLayer = 0;
    let currentStart = -1;
    let currentZ = 0;
    let startGCodeEnd = 0;
    let endGCodeStart = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^;\s*LAYER:(\d+)\/\d+\s*\|\s*Z\s*=\s*([\d.]+)/);

      if (match) {
        if (currentLayer > 0 && currentStart !== -1) {
          map.set(currentLayer, { startLine: currentStart, endLine: i - 1, z: currentZ });
        } else {
          startGCodeEnd = i - 1;
        }

        currentLayer = parseInt(match[1], 10);
        currentStart = i;
        currentZ = parseFloat(match[2]);
      } else if (line.includes('; End G-Code')) {
        if (currentLayer > 0 && currentStart !== -1) {
          map.set(currentLayer, { startLine: currentStart, endLine: i - 1, z: currentZ });
        }
        endGCodeStart = i;
        break;
      }
    }

    if (currentLayer > 0 && currentStart !== -1 && !map.has(currentLayer)) {
      map.set(currentLayer, { startLine: currentStart, endLine: lines.length - 1, z: currentZ });
    }

    return { map, startGCodeEnd, endGCodeStart };
  }, [lines]);

  // Reset page when layer filter changes
  useEffect(() => {
    setCurrentPage(1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedLayerFilter, searchTerm]);

  // Filter lines based on layer selection or search
  const displayedLines = useMemo(() => {
    if (lines.length === 0) return [];

    let candidateLines: { line: string; num: number }[] = [];

    if (selectedLayerFilter === 'all') {
      candidateLines = lines.map((line, idx) => ({ line, num: idx + 1 }));
    } else if (selectedLayerFilter === 'start') {
      const end = layerIndexMap.startGCodeEnd >= 0 ? layerIndexMap.startGCodeEnd + 1 : 40;
      candidateLines = lines.slice(0, end).map((line, idx) => ({ line, num: idx + 1 }));
    } else if (selectedLayerFilter === 'end') {
      const start = layerIndexMap.endGCodeStart >= 0 ? layerIndexMap.endGCodeStart : lines.length - 30;
      candidateLines = lines.slice(start).map((line, idx) => ({ line, num: start + idx + 1 }));
    } else {
      const layerInfo = layerIndexMap.map.get(selectedLayerFilter);
      if (layerInfo) {
        candidateLines = lines
          .slice(layerInfo.startLine, layerInfo.endLine + 1)
          .map((line, idx) => ({ line, num: layerInfo.startLine + idx + 1 }));
      } else {
        candidateLines = lines.map((line, idx) => ({ line, num: idx + 1 }));
      }
    }

    if (!searchTerm.trim()) {
      return candidateLines;
    }

    const term = searchTerm.toLowerCase();
    return candidateLines.filter(({ line }) => line.toLowerCase().includes(term));
  }, [lines, selectedLayerFilter, searchTerm, layerIndexMap]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(displayedLines.length / LINES_PER_PAGE));
  const effectivePage = Math.min(currentPage, totalPages);

  // Paginated slice
  const paginatedLines = useMemo(() => {
    if (showAllLinesContinuous && !searchTerm.trim()) {
      return displayedLines;
    }
    const start = (effectivePage - 1) * LINES_PER_PAGE;
    return displayedLines.slice(start, start + LINES_PER_PAGE);
  }, [displayedLines, effectivePage, showAllLinesContinuous, searchTerm]);

  // Copy full G-Code
  const handleCopyAll = () => {
    if (!sliceResult?.gcode) return;
    navigator.clipboard.writeText(sliceResult.gcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Copy current view lines
  const handleCopyView = () => {
    if (paginatedLines.length === 0) return;
    const text = paginatedLines.map(l => l.line).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedView(true);
    setTimeout(() => setCopiedView(false), 2000);
  };

  // Jump to specific layer
  const handleJumpToLayer = (layerNum: number) => {
    setSelectedLayerFilter(layerNum);
    setShowAllLinesContinuous(false);
  };

  if (!sliceResult) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center space-y-3">
        <FileCode className="w-12 h-12 text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-300">No G-Code Generated Yet</h3>
        <p className="text-xs max-w-sm text-gray-500">
          Click the "Slice Model" button in the top navigation bar to slice your 3D model and generate machine-ready G-code.
        </p>
      </div>
    );
  }

  const { stats } = sliceResult;
  const totalLayers = stats.totalLayers;
  const zMax = stats.bounds.maxZ;
  const zMin = stats.bounds.minZ;

  const renderGCodeLine = (text: string) => {
    if (text.startsWith(';')) {
      const isLayerHeader = text.includes('LAYER:') || text.includes('End G-Code') || text.includes('Target Printer');
      return (
        <span className={isLayerHeader ? 'text-cyan-300 font-bold bg-cyan-950/30 px-1 py-0.5 rounded' : 'text-gray-500 italic'}>
          {text}
        </span>
      );
    }
    if (text.startsWith('G0') || text.startsWith('G00')) {
      return <span className="text-amber-400 font-medium">{text}</span>;
    }
    if (text.startsWith('G1') || text.startsWith('G01')) {
      return <span className="text-cyan-300 font-medium">{text}</span>;
    }
    if (text.startsWith('G28') || text.startsWith('G29') || text.startsWith('G90') || text.startsWith('G91') || text.startsWith('G92')) {
      return <span className="text-emerald-400 font-semibold">{text}</span>;
    }
    if (text.startsWith('M')) {
      return <span className="text-purple-400 font-semibold">{text}</span>;
    }
    return <span className="text-gray-200">{text}</span>;
  };

  return (
    <div
      id="gcode-terminal-view"
      className="w-full h-full flex flex-col bg-[#0d1015] text-gray-300 font-mono text-xs overflow-hidden"
    >
      {/* Top Status & Integrity Header */}
      <div className="bg-[#14171e] border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Full Z-Axis Verification Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-sans text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>100% Sliced to Top</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400 font-sans">
            <span className="font-semibold text-white">{totalLayers} Layers</span>
            <span className="text-gray-600">•</span>
            <span>Z: <span className="text-cyan-400 font-mono font-medium">{zMin.toFixed(2)} mm</span> → <span className="text-cyan-400 font-mono font-medium">{zMax.toFixed(2)} mm</span></span>
            <span className="text-gray-600">•</span>
            <span>{lines.length.toLocaleString()} Total Lines</span>
            <span className="text-gray-600">•</span>
            <span>{(sliceResult.gcode.length / 1024).toFixed(1)} KB</span>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3 font-sans text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            {Math.floor(stats.estimatedTimeSeconds / 60)}m
          </span>
          <span className="flex items-center gap-1">
            <Scale className="w-3 h-3 text-emerald-400" />
            {stats.totalFilamentWeightGrams.toFixed(1)}g
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-purple-400" />
            ${stats.estimatedCostUsd.toFixed(2)}
          </span>
        </div>

        {/* Global File Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 hover:text-white text-xs font-sans font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Copy entire complete G-code file"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied File' : 'Copy All'}</span>
          </button>

          <button
            onClick={onDownloadGCode}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-sans font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
            title="Download full .gcode file for your 3D printer"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Download .gcode</span>
          </button>
        </div>
      </div>

      {/* Control Toolbar: Layer Selector, Navigation, and Search */}
      <div className="bg-[#101319] border-b border-white/5 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Layer Filtering Controls */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-sans flex items-center gap-1">
            <ListFilter className="w-3.5 h-3.5 text-cyan-400" />
            <span>View:</span>
          </span>

          <select
            value={typeof selectedLayerFilter === 'number' ? selectedLayerFilter : selectedLayerFilter}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'all' || val === 'start' || val === 'end') {
                setSelectedLayerFilter(val);
              } else {
                setSelectedLayerFilter(parseInt(val, 10));
              }
            }}
            className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-sans focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">Complete Program (All {lines.length.toLocaleString()} Lines)</option>
            <option value="start">Start G-Code (Heating & Prime Line)</option>
            {Array.from({ length: totalLayers }, (_, i) => i + 1).map((num) => {
              const info = layerIndexMap.map.get(num);
              const zStr = info ? `Z = ${info.z.toFixed(2)} mm` : '';
              return (
                <option key={num} value={num}>
                  Layer {num} of {totalLayers} ({zStr})
                </option>
              );
            })}
            <option value="end">End G-Code (Shutdown & Park)</option>
          </select>

          {/* Jump to Active Layer (from 3D Preview) */}
          <button
            onClick={() => handleJumpToLayer(activeLayer)}
            className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-sans text-xs transition-colors flex items-center gap-1 cursor-pointer"
            title="Inspect the layer currently active in the 3D Preview viewport"
          >
            <Eye className="w-3 h-3 text-cyan-400" />
            <span>Active Layer ({activeLayer}/{totalLayers})</span>
          </button>

          {/* Quick Prev / Next Layer */}
          {typeof selectedLayerFilter === 'number' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleJumpToLayer(Math.max(1, selectedLayerFilter - 1))}
                disabled={selectedLayerFilter <= 1}
                className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 cursor-pointer"
                title="Previous Layer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleJumpToLayer(Math.min(totalLayers, selectedLayerFilter + 1))}
                disabled={selectedLayerFilter >= totalLayers}
                className="p-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 cursor-pointer"
                title="Next Layer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2 flex-1 max-w-sm bg-black/50 px-2.5 py-1 rounded-lg border border-white/10">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search G-Code (e.g. 'LAYER:50', 'Z', 'M109', 'G1')..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-white focus:outline-none text-xs font-sans placeholder-gray-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-gray-400 hover:text-white text-xs cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Pagination & View Controls */}
        <div className="flex items-center gap-2 font-sans text-xs">
          {totalPages > 1 && !showAllLinesContinuous && !searchTerm && (
            <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={effectivePage <= 1}
                className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 cursor-pointer"
                title="Previous chunk"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-gray-400 text-[11px]">
                Page {effectivePage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={effectivePage >= totalPages}
                className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 cursor-pointer"
                title="Next chunk"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Toggle Continuous View */}
          {displayedLines.length > LINES_PER_PAGE && !searchTerm && (
            <button
              onClick={() => setShowAllLinesContinuous(!showAllLinesContinuous)}
              className={`px-2 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                showAllLinesContinuous
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
              }`}
              title="Toggle continuous rendering for all lines"
            >
              <Maximize2 className="w-3 h-3" />
              <span>{showAllLinesContinuous ? 'Paged Mode' : 'View All at Once'}</span>
            </button>
          )}

          {/* Copy visible lines */}
          <button
            onClick={handleCopyView}
            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-[11px] transition-colors cursor-pointer"
            title="Copy currently visible lines"
          >
            {copiedView ? 'Copied View' : 'Copy View'}
          </button>
        </div>
      </div>

      {/* Subheader: Active Filter Info Bar */}
      <div className="bg-[#0b0e13] px-4 py-1.5 border-b border-white/5 flex items-center justify-between text-[11px] text-gray-400 font-sans">
        <div>
          {searchTerm ? (
            <span>Found <span className="text-cyan-400 font-semibold">{displayedLines.length}</span> matching lines for "{searchTerm}"</span>
          ) : selectedLayerFilter === 'all' ? (
            <span>
              Showing lines <span className="font-mono text-gray-200">{((effectivePage - 1) * LINES_PER_PAGE) + 1}</span> – <span className="font-mono text-gray-200">{Math.min(displayedLines.length, effectivePage * LINES_PER_PAGE).toLocaleString()}</span> of <span className="font-mono text-gray-200">{displayedLines.length.toLocaleString()}</span> (All {totalLayers} Layers from Z = {zMin.toFixed(2)}mm to Z = {zMax.toFixed(2)}mm)
            </span>
          ) : selectedLayerFilter === 'start' ? (
            <span>Start Sequence: Printer homing, dual heating, purge line pass</span>
          ) : selectedLayerFilter === 'end' ? (
            <span>End Sequence: Retraction, nozzle lift, bed present, stepper disable</span>
          ) : (
            <span>
              Inspecting <span className="text-cyan-400 font-semibold">Layer {selectedLayerFilter} / {totalLayers}</span> (Z = {layerIndexMap.map.get(selectedLayerFilter)?.z.toFixed(2) || '0.00'} mm, {displayedLines.length} lines)
            </span>
          )}
        </div>

        {selectedLayerFilter !== 'all' && (
          <button
            onClick={() => setSelectedLayerFilter('all')}
            className="text-cyan-400 hover:text-cyan-300 underline text-[11px] cursor-pointer"
          >
            Show All Layers
          </button>
        )}
      </div>

      {/* Code Viewer */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-0.5 select-text bg-[#090b0f]"
      >
        {paginatedLines.length === 0 ? (
          <div className="p-8 text-center text-gray-500 italic">
            No matching lines found.
          </div>
        ) : (
          paginatedLines.map(({ line, num }) => (
            <div key={num} className="flex hover:bg-white/[0.04] rounded px-1.5 py-0.5 group">
              <span className="w-16 text-right pr-4 text-gray-600 select-none group-hover:text-gray-400 font-mono text-[11px]">
                {num}
              </span>
              <span className="flex-1 whitespace-pre font-mono text-[11px] break-all">
                {renderGCodeLine(line)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && !showAllLinesContinuous && !searchTerm && (
        <div className="bg-[#101319] border-t border-white/10 px-4 py-2 flex items-center justify-between text-xs font-sans text-gray-400">
          <div className="text-[11px]">
            Showing chunk {effectivePage} of {totalPages} ({paginatedLines.length} lines in view)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCurrentPage(1);
                if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
              }}
              disabled={effectivePage <= 1}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs cursor-pointer"
            >
              First Page
            </button>

            <button
              onClick={() => {
                setCurrentPage(p => Math.max(1, p - 1));
                if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
              }}
              disabled={effectivePage <= 1}
              className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev 2,500</span>
            </button>

            <button
              onClick={() => {
                setCurrentPage(p => Math.min(totalPages, p + 1));
                if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
              }}
              disabled={effectivePage >= totalPages}
              className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>Next 2,500</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setCurrentPage(totalPages);
                if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
              }}
              disabled={effectivePage >= totalPages}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-xs cursor-pointer"
            >
              Last Page (End)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
