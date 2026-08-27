"use client";

import React, { useState, useEffect, useId } from 'react';
import { TelemetryPoint } from '@/types/engine';
import { 
  calculateOperationalImpact, 
  DEFAULT_OPERATIONAL_ASSUMPTIONS, 
  OperationalAssumptions,
  OperationalImpactSummary 
} from '@/utils/operationalImpact';
import { 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Info, 
  SlidersHorizontal, 
  RotateCcw, 
  Sparkles,
  Plane,
  X
} from 'lucide-react';

interface Props {
  telemetry: TelemetryPoint;
  className?: string;
}

// Lightweight smooth counter hook
function useCountUp(target: number, duration: number = 800) {
  const [count, setCount] = useState<number>(target);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const initial = count;
    const diff = target - initial;

    if (diff === 0) return;

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(initial + diff * easeProgress));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration]);

  return count;
}

export default function OperationalImpactSection({ telemetry, className = "" }: Props) {
  const tooltipId = useId();
  const [assumptions, setAssumptions] = useState<OperationalAssumptions>(DEFAULT_OPERATIONAL_ASSUMPTIONS);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  // Compute live operational impact summary
  const impact: OperationalImpactSummary = calculateOperationalImpact(telemetry, assumptions);

  // Animated counters for key metrics
  const animatedCycles = useCountUp(impact.earlyCycles, 600);
  const animatedSavingsMin = useCountUp(impact.savingsMin, 700);
  const animatedSavingsMax = useCountUp(impact.savingsMax, 700);
  const animatedDowntimeMin = useCountUp(Math.round(impact.downtimeAvoidedMinHours), 600);
  const animatedDowntimeMax = useCountUp(Math.round(impact.downtimeAvoidedMaxHours), 600);

  const resetAssumptions = () => {
    setAssumptions(DEFAULT_OPERATIONAL_ASSUMPTIONS);
  };

  return (
    <div className={`w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col gap-0 ${className}`}>
      {/* 1. Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-700/60 text-emerald-400 flex items-center justify-center shadow-inner">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
                Decision Support
              </span>
              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                Confidence: <strong className="text-emerald-300">{impact.confidenceScore}%</strong>
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 font-cinzel">
              Estimated Operational Impact
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Configurable assumptions toggle */}
          <button
            id="btn-toggle-assumptions"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            title="Configure Prototype Assumptions"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Assumptions</span>
            <span className="text-[10px] bg-slate-900 text-emerald-400 px-1.5 py-0.2 rounded border border-slate-700">
              {impact.earlyCycles}C
            </span>
          </button>
        </div>
      </div>

      {/* Assumptions Config Drawer (Collapsible) */}
      {isConfigOpen && (
        <div className="p-4 bg-slate-900 text-slate-200 border-b border-slate-800 text-xs font-mono animate-fade-in">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                Configurable Prototype Operational Assumptions
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetAssumptions}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 flex items-center gap-1 border border-slate-700"
              >
                <RotateCcw className="w-3 h-3" /> Reset Defaults
              </button>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Control 1: Early Detection Cycles */}
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-slate-400">
                <span>Early Detection Cycles:</span>
                <span className="text-emerald-400 font-bold">{assumptions.earlyDetectionCycles} cycles</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                step="5"
                value={assumptions.earlyDetectionCycles}
                onChange={(e) => setAssumptions(prev => ({ ...prev, earlyDetectionCycles: Number(e.target.value) }))}
                className="accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">Lead time ahead of scheduled inspection threshold</span>
            </div>

            {/* Control 2: Value per Cycle ($) */}
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-slate-400">
                <span>Value per Early Cycle:</span>
                <span className="text-emerald-400 font-bold">${assumptions.valuePerCycleMin} – ${assumptions.valuePerCycleMax}</span>
              </div>
              <input
                type="range"
                min="150"
                max="600"
                step="25"
                value={assumptions.valuePerCycleMin}
                onChange={(e) => {
                  const minVal = Number(e.target.value);
                  setAssumptions(prev => ({
                    ...prev,
                    valuePerCycleMin: minVal,
                    valuePerCycleMax: Math.round(minVal * 1.5)
                  }));
                }}
                className="accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">Conservative operational value gained per cycle</span>
            </div>

            {/* Control 3: Downtime Avoided per Cycle */}
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-slate-400">
                <span>Downtime Hours Factor:</span>
                <span className="text-emerald-400 font-bold">{(assumptions.downtimeHoursPerCycleMin * assumptions.earlyDetectionCycles).toFixed(0)} – {(assumptions.downtimeHoursPerCycleMax * assumptions.earlyDetectionCycles).toFixed(0)} hrs</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.50"
                step="0.05"
                value={assumptions.downtimeHoursPerCycleMin}
                onChange={(e) => {
                  const minH = Number(e.target.value);
                  setAssumptions(prev => ({
                    ...prev,
                    downtimeHoursPerCycleMin: minH,
                    downtimeHoursPerCycleMax: Number((minH * 1.75).toFixed(2))
                  }));
                }}
                className="accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">Unscheduled AOG risk mitigation rate</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Hero Metric & Operational Financial Cards Grid */}
      <div className="p-4 sm:p-6 bg-slate-50/60 flex flex-col gap-5">
        {/* Core Value Summary Grid: Hero Callout + 2 Sub-metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* HERO ELEMENT: "40 CYCLES EARLY" - The Strongest Visual Element */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-md relative overflow-hidden flex flex-col justify-between group">
            {/* Subtle aviation background watermark styling */}
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-white">
              <Plane className="w-32 h-32 -rotate-12" />
            </div>

            {/* Glowing Accent Top Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Early Detection Advantage
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  ML vs Scheduled
                </span>
              </div>

              {/* Main Prominent Hero Number */}
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl lg:text-6xl font-mono font-black text-emerald-400 tracking-tight drop-shadow-sm font-poppins">
                    {animatedCycles}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg sm:text-xl font-bold uppercase tracking-tight text-white font-cinzel leading-none">
                      Cycles Early
                    </span>
                    <span className="text-[11px] font-mono text-emerald-300/80 font-medium">
                      Advance Lead Time
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Detection at Cycle #{telemetry.cycle}</span>
              </div>
              <span className="text-emerald-400 font-semibold">
                +40C Lead Time
              </span>
            </div>
          </div>

          {/* SECONDARY IMPACT CARDS: Estimated Savings + Downtime Avoided */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Card 1: Estimated Savings */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all group">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 font-mono">
                      Estimated Savings
                    </span>
                  </div>

                  {/* Information Tooltip */}
                  <div className="relative">
                    <button
                      type="button"
                      aria-describedby={showTooltip ? tooltipId : undefined}
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                      onClick={() => setShowTooltip(!showTooltip)}
                      className="p-1 text-slate-400 hover:text-slate-700 transition-colors rounded-full focus:outline-none"
                      title="Operational Assumption Details"
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    {showTooltip && (
                      <div id={tooltipId} role="tooltip" className="absolute right-0 top-6 z-30 w-64 p-3 bg-slate-900 text-slate-200 rounded-xl shadow-xl border border-slate-700 text-[11px] font-sans leading-relaxed animate-fade-in">
                        <div className="flex items-center gap-1 text-emerald-400 font-bold font-mono mb-1 text-[10px] uppercase">
                          <Sparkles className="w-3 h-3" /> Heuristic Basis
                        </div>
                        {impact.tooltipText}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-slate-900 tracking-tight font-poppins">
                    ${animatedSavingsMin.toLocaleString()} – ${animatedSavingsMax.toLocaleString()}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Direct maintenance &amp; flight cancellation cost avoidance
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Value / Cycle:</span>
                <span className="font-semibold text-emerald-800">
                  ${assumptions.valuePerCycleMin} – ${assumptions.valuePerCycleMax}
                </span>
              </div>
            </div>

            {/* Card 2: Potential Downtime Avoided */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all group">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 font-mono">
                      Potential Downtime Avoided
                    </span>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-slate-900 tracking-tight font-poppins">
                    {animatedDowntimeMin} – {animatedDowntimeMax} hours
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Mitigates unscheduled Aircraft On Ground (AOG) delays
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>AOG Disruption Factor:</span>
                <span className="font-semibold text-teal-800">
                  0.20 – 0.35 hrs / cycle
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* 3. Label & Disclaimer */}
        <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 text-center text-[11px] font-mono text-slate-500">
          <p>
            <strong className="text-slate-700">Prototype estimate based on configurable operational assumptions.</strong> Does not represent guaranteed failure prevention or official airline accounting data.
          </p>
        </div>

      </div>
    </div>
  );
}
