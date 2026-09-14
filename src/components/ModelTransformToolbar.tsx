import React from 'react';
import {
  Move,
  RotateCcw,
  Maximize2,
  Lock,
  Unlock,
  Crosshair,
  ArrowDownToLine,
  Sliders,
  Sparkles
} from 'lucide-react';
import { LoadedModel, ModelTransform } from '../types';

interface ModelTransformToolbarProps {
  model: LoadedModel | null;
  onTransformChange: (transform: ModelTransform) => void;
  onCenterOnBed: () => void;
  onLayFlat: () => void;
  onRepair: () => void;
  onAutoOrient: () => void;
}

export const ModelTransformToolbar: React.FC<ModelTransformToolbarProps> = ({
  model,
  onTransformChange,
  onCenterOnBed,
  onLayFlat,
  onRepair,
  onAutoOrient
}) => {
  if (!model) return null;

  const t = model.transform;

  const updatePosition = (axis: 'x' | 'y' | 'z', value: number) => {
    onTransformChange({
      ...t,
      position: { ...t.position, [axis]: value }
    });
  };

  const updateRotation = (axis: 'x' | 'y' | 'z', value: number) => {
    onTransformChange({
      ...t,
      rotation: { ...t.rotation, [axis]: value }
    });
  };

  const rotate90 = (axis: 'x' | 'y' | 'z') => {
    const current = t.rotation[axis];
    onTransformChange({
      ...t,
      rotation: { ...t.rotation, [axis]: (current + 90) % 360 }
    });
  };

  const updateScale = (axis: 'x' | 'y' | 'z', value: number) => {
    const clampedValue = Math.max(0.01, value);
    if (t.uniformScale) {
      onTransformChange({
        ...t,
        scale: { x: clampedValue, y: clampedValue, z: clampedValue }
      });
    } else {
      onTransformChange({
        ...t,
        scale: { ...t.scale, [axis]: clampedValue }
      });
    }
  };

  const toggleUniformScale = () => {
    onTransformChange({
      ...t,
      uniformScale: !t.uniformScale
    });
  };

  const currentW = (model.originalDimensions.x * t.scale.x).toFixed(1);
  const currentD = (model.originalDimensions.y * t.scale.y).toFixed(1);
  const currentH = (model.originalDimensions.z * t.scale.z).toFixed(1);

  return (
    <div
      id="model-transform-toolbar"
      className="p-3 space-y-4 shadow-inner"
    >
      {/* Quick Actions Strip */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-1.5 w-full">
          <button
            onClick={onCenterOnBed}
            className="flex-1 p-1 rounded bg-white/5 hover:bg-white/15 text-gray-300 hover:text-cyan-300 transition-colors cursor-pointer flex justify-center"
            title="Center Model on Bed"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onLayFlat}
            className="flex-1 p-1 rounded bg-white/5 hover:bg-white/15 text-gray-300 hover:text-cyan-300 transition-colors cursor-pointer flex justify-center"
            title="Lay Flat on Bed Surface"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRepair}
            className="flex-1 p-1 rounded bg-white/5 hover:bg-white/15 text-gray-300 hover:text-emerald-300 transition-colors cursor-pointer flex justify-center"
            title="Auto-Repair Model Mesh (Server-Side)"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </button>
          <button
            onClick={onAutoOrient}
            className="flex-1 p-1 rounded bg-white/5 hover:bg-white/15 text-gray-300 hover:text-amber-300 transition-colors cursor-pointer flex justify-center"
            title="Auto-Orient for Optimal Slicing (AI Optimization)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Scale Section */}
      <div className="space-y-1.5">
        {/* Current mm Dimensions */}
        <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 pb-1 border-b border-white/5">
          <span>Dimensions:</span>
          <span className="text-white">
            {currentW} × {currentD} × {currentH} mm
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <Maximize2 className="w-3 h-3 text-emerald-400" /> Scale (Factor)
          </span>
          <button
            onClick={toggleUniformScale}
            className="text-[10px] text-gray-400 hover:text-white flex items-center gap-0.5"
          >
            {t.uniformScale ? <Lock className="w-3 h-3 text-cyan-400" /> : <Unlock className="w-3 h-3 text-amber-400" />}
            <span>{t.uniformScale ? 'Uniform' : 'Free'}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
          <div className="flex items-center bg-black/40 rounded border border-white/5 px-2 py-1">
            <span className="text-rose-400 text-[10px] font-bold mr-1">X</span>
            <input
              type="number"
              step="0.1"
              value={t.scale.x.toFixed(2)}
              onChange={(e) => updateScale('x', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-white focus:outline-none text-right"
            />
          </div>
          <div className="flex items-center bg-black/40 rounded border border-white/5 px-2 py-1">
            <span className="text-emerald-400 text-[10px] font-bold mr-1">Y</span>
            <input
              type="number"
              step="0.1"
              value={t.scale.y.toFixed(2)}
              onChange={(e) => updateScale('y', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-white focus:outline-none text-right"
            />
          </div>
          <div className="flex items-center bg-black/40 rounded border border-white/5 px-2 py-1">
            <span className="text-cyan-400 text-[10px] font-bold mr-1">Z</span>
            <input
              type="number"
              step="0.1"
              value={t.scale.z.toFixed(2)}
              onChange={(e) => updateScale('z', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-white focus:outline-none text-right"
            />
          </div>
        </div>
      </div>

      {/* Position Section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <Move className="w-3 h-3 text-cyan-400" /> Position (mm)
          </span>
          <span className="text-[10px] text-gray-500 font-mono">Relative to Bed Origin</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
          <div className="flex items-center bg-black/40 rounded border border-white/5 px-2 py-1">
            <span className="text-rose-400 text-[10px] font-bold mr-1">X</span>
            <input
              type="number"
              value={Math.round(t.position.x)}
              onChange={(e) => updatePosition('x', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-white focus:outline-none text-right"
            />
          </div>
          <div className="flex items-center bg-black/40 rounded border border-white/5 px-2 py-1">
            <span className="text-emerald-400 text-[10px] font-bold mr-1">Y</span>
            <input
              type="number"
              value={Math.round(t.position.y)}
              onChange={(e) => updatePosition('y', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-white focus:outline-none text-right"
            />
          </div>
          <div className="flex items-center bg-black/40 rounded border border-white/5 px-2 py-1">
            <span className="text-cyan-400 text-[10px] font-bold mr-1">Z</span>
            <input
              type="number"
              value={Math.round(t.position.z)}
              onChange={(e) => updatePosition('z', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-white focus:outline-none text-right"
            />
          </div>
        </div>
      </div>

      {/* Rotation Section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <RotateCcw className="w-3 h-3 text-amber-400" /> Rotation (deg)
          </span>
          <span className="text-[10px] text-gray-500 font-mono">+90° buttons</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
          <div className="flex items-center bg-black/40 rounded border border-white/5 px-2 py-1">
            <span className="text-rose-400 text-[10px] font-bold mr-1">X</span>
            <input
              type="number"
              value={Math.round(t.rotation.x)}
              onChange={(e) => updateRotation('x', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-white focus:outline-none text-right"
            />
            <button
              onClick={() => rotate90('x')}
              className="ml-1 text-[10px] text-gray-500 hover:text-white font-bold"
            >
              +90
            </button>
          </div>
          <div className="flex items-center bg-black/40 rounded border border-white/5 px-2 py-1">
            <span className="text-emerald-400 text-[10px] font-bold mr-1">Y</span>
            <input
              type="number"
              value={Math.round(t.rotation.y)}
              onChange={(e) => updateRotation('y', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-white focus:outline-none text-right"
            />
            <button
              onClick={() => rotate90('y')}
              className="ml-1 text-[10px] text-gray-500 hover:text-white font-bold"
            >
              +90
            </button>
          </div>
          <div className="flex items-center bg-black/40 rounded border border-white/5 px-2 py-1">
            <span className="text-cyan-400 text-[10px] font-bold mr-1">Z</span>
            <input
              type="number"
              value={Math.round(t.rotation.z)}
              onChange={(e) => updateRotation('z', parseFloat(e.target.value) || 0)}
              className="w-full bg-transparent text-white focus:outline-none text-right"
            />
            <button
              onClick={() => rotate90('z')}
              className="ml-1 text-[10px] text-gray-500 hover:text-white font-bold"
            >
              +90
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
