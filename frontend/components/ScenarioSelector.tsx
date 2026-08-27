"use client";

import React, { useState } from 'react';
import { FlightScenario } from '@/types/engine';
import { SYNTHETIC_SCENARIOS } from '@/utils/telemetryEngine';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Flame, 
  Zap, 
  AlertTriangle, 
  ShieldAlert, 
  Droplet, 
  Gauge, 
  Activity,
  Plane,
  Database,
  Dices,
  Sliders,
  CheckCircle2
} from 'lucide-react';

interface Props {
  currentScenario: FlightScenario;
  onSelectScenario: (id: string) => void;
  onCustomUnitSelect?: (datasetFile: string, unitNumber: string) => void;
  isRunning: boolean;
  onToggleRunning: () => void;
  onReset: () => void;
  simSpeed: number;
  onSimSpeedChange: (spd: number) => void;
  dataMode: 'random' | 'dataset';
  onToggleDataMode: (mode: 'random' | 'dataset') => void;
  currentDataset?: string;
  currentUnit?: string;
  totalCycles?: number;
}

const PRESET_UNITS = [
  { unit: "82", desc: "Compound Hot-Section & Compressor Degradation (194 Cycles)" },
  { unit: "15", desc: "HPT Thermal Barrier Coating Loss (148 Cycles)" },
  { unit: "44", desc: "Long-Duration Multi-Stage Wear (218 Cycles)" },
  { unit: "28", desc: "High-Spool Friction & LPT Bleed Deficit (165 Cycles)" },
  { unit: "91", desc: "Severe Interstage Pressure Loss (230 Cycles)" },
  { unit: "1",  desc: "Baseline Line Aircraft Run (126 Cycles)" }
];

export default function ScenarioSelector({
  currentScenario,
  onSelectScenario,
  onCustomUnitSelect,
  isRunning,
  onToggleRunning,
  onReset,
  simSpeed,
  onSimSpeedChange,
  dataMode,
  onToggleDataMode,
  currentDataset = "FD003",
  currentUnit = "82",
  totalCycles = 194
}: Props) {
  const [selectedDataset, setSelectedDataset] = useState<string>(currentDataset);
  const [customUnitInput, setCustomUnitInput] = useState<string>("");

  const getIcon = (name: string) => {
    switch (name) {
      case 'Plane': return <Plane className="w-4 h-4" />;
      case 'Flame': return <Flame className="w-4 h-4" />;
      case 'Zap': return <Zap className="w-4 h-4" />;
      case 'AlertTriangle': return <AlertTriangle className="w-4 h-4" />;
      case 'ShieldAlert': return <ShieldAlert className="w-4 h-4" />;
      case 'Droplet': return <Droplet className="w-4 h-4" />;
      case 'Gauge': return <Gauge className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const unitNum = parseInt(customUnitInput.trim(), 10);
    if (!isNaN(unitNum) && unitNum >= 1 && unitNum <= 100 && onCustomUnitSelect) {
      onCustomUnitSelect(selectedDataset, String(unitNum));
      setCustomUnitInput("");
    }
  };

  const handlePresetClick = (unit: string) => {
    if (onCustomUnitSelect) {
      onCustomUnitSelect(selectedDataset, unit);
    }
  };

  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
      {/* Header & Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 font-cinzel">
              {dataMode === 'dataset' ? <Database className="w-4 h-4 text-emerald-800" /> : <Dices className="w-4 h-4 text-amber-700" />}
              {dataMode === 'dataset' ? 'Recorded NASA C-MAPSS Flight Test Library' : 'Synthetic Flight Envelope & Failure Injection Testbed'}
            </h3>

            {dataMode === 'dataset' ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-900 text-emerald-100 border border-emerald-700 shadow-sm">
                Asset: {currentDataset} • Unit #{currentUnit} ({totalCycles} Cycles)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-900 text-amber-100 border border-amber-700 shadow-sm">
                Synthetic Envelope Stream
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {dataMode === 'dataset' 
              ? 'Replaying historical engine flight cycle recordings from NASA C-MAPSS turbofan test benches' 
              : 'Generating dynamic sensor envelopes with selectable in-flight mechanical fault conditions'}
          </p>
        </div>

        {/* Mode Toggle, Playback & Speed Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-mono">
            <button
              onClick={() => onToggleDataMode('dataset')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                dataMode === 'dataset' 
                  ? 'bg-emerald-800 text-white font-bold shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Flight Test Library</span>
            </button>
            <button
              onClick={() => onToggleDataMode('random')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                dataMode === 'random' 
                  ? 'bg-amber-700 text-white font-bold shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Dices className="w-3.5 h-3.5" />
              <span>Synthetic Envelope</span>
            </button>
          </div>

          {/* Play/Pause Button */}
          <button
            id="btn-toggle-sim"
            onClick={onToggleRunning}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 text-white ${
              isRunning 
                ? 'bg-amber-700 hover:bg-amber-800' 
                : 'bg-emerald-800 hover:bg-emerald-900'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isRunning ? 'Pause' : 'Resume'}</span>
          </button>

          <button
            id="btn-reset-sim"
            onClick={onReset}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors shadow-sm"
            title="Restart Telemetry Stream"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Speed Toggles */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px] font-mono">
            {[1, 2, 5, 10].map((spd) => (
              <button
                key={spd}
                id={`btn-speed-${spd}x`}
                onClick={() => onSimSpeedChange(spd)}
                className={`px-2 py-1 rounded-lg transition-all ${
                  simSpeed === spd 
                    ? dataMode === 'dataset' ? 'bg-emerald-800 text-white font-bold shadow-sm' : 'bg-amber-700 text-white font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dataset Mode Content: NASA C-MAPSS Unit Picker */}
      {dataMode === 'dataset' ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-mono font-semibold text-slate-700 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-emerald-800" />
              Select Turbofan Engine Fleet Unit:
            </span>

            {/* Custom Unit Loader Form */}
            <form onSubmit={handleCustomSubmit} className="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-[11px] font-mono text-slate-600 px-2">Dataset File:</span>
              <select
                value={selectedDataset}
                onChange={(e) => {
                  setSelectedDataset(e.target.value);
                  if (onCustomUnitSelect) onCustomUnitSelect(e.target.value, currentUnit);
                }}
                className="bg-white text-emerald-900 font-mono font-bold text-[11px] px-2 py-1 rounded-lg border border-slate-200 focus:outline-none cursor-pointer shadow-sm"
              >
                <option value="FD003">FD003 (Compound Multi-Fault)</option>
                <option value="FD004">FD004 (Multi-Condition Flight)</option>
              </select>

              <span className="text-slate-300 font-mono mx-2">|</span>
              
              <input
                type="number"
                min="1"
                max="100"
                placeholder="Unit # (1-100)"
                value={customUnitInput}
                onChange={(e) => setCustomUnitInput(e.target.value)}
                className="bg-white text-slate-900 font-mono text-[11px] w-24 px-2 py-1 rounded-lg border border-slate-200 focus:outline-none placeholder:text-slate-400 shadow-sm"
              />
              <button
                type="submit"
                className="ml-1.5 px-3 py-1 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg text-[11px] transition-colors shadow-sm"
              >
                Load Unit
              </button>
            </form>
          </div>

          {/* Quick Engine Preset Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {PRESET_UNITS.map((p) => {
              const isSelected = currentUnit === p.unit;
              return (
                <button
                  key={p.unit}
                  onClick={() => handlePresetClick(p.unit)}
                  className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-900 border-emerald-700 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'bg-slate-50 border-slate-200 hover:border-emerald-700 hover:bg-emerald-50/20 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono font-bold flex items-center gap-1.5 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />}
                      Engine #{p.unit}
                    </span>
                    <span className={`text-[10px] font-mono font-semibold ${isSelected ? 'text-emerald-200' : 'text-emerald-800'}`}>FD003</span>
                  </div>
                  <p className={`text-[10px] line-clamp-2 leading-tight ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
                    {p.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Random Sim Mode Content: Fault Scenarios Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {SYNTHETIC_SCENARIOS.map((sc) => {
            const isSelected = currentScenario.id === sc.id;
            const isCrit = sc.expectedSeverity === 'CRITICAL';
            const isWarn = sc.expectedSeverity === 'WARNING';

            return (
              <button
                key={sc.id}
                id={`btn-scenario-${sc.id}`}
                onClick={() => onSelectScenario(sc.id)}
                className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-emerald-900 border-emerald-700 text-white shadow-sm ring-1 ring-emerald-500'
                    : 'bg-slate-50 border-slate-200 hover:border-emerald-700 hover:bg-emerald-50/20 text-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${
                      isSelected ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {getIcon(sc.iconName)}
                    </div>
                    <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {sc.name}
                    </span>
                  </div>
                </div>

                <p className={`text-[10px] leading-snug line-clamp-2 ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
                  {sc.description}
                </p>

                <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-slate-200/50">
                  <span className={`uppercase ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>{sc.category}</span>
                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                    isCrit ? 'text-red-200 bg-red-950 border border-red-800' : isWarn ? 'text-amber-200 bg-amber-950 border border-amber-800' : 'text-emerald-200 bg-emerald-950 border border-emerald-800'
                  }`}>
                    {sc.expectedSeverity}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
