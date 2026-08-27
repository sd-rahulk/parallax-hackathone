"use client";

import React, { useState } from 'react';
import { 
  TelemetryPoint, 
  SubsystemId, 
  Severity 
} from '@/types/engine';
import { SUBSYSTEMS } from '@/utils/telemetryEngine';
import { predictEngineHealth, getAll50Recommendations, DetailedFaultRecommendation } from '@/utils/engineRecommender';
import OperationalImpactSection from '@/components/OperationalImpactSection';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  Gauge, 
  Flame, 
  Activity, 
  Zap, 
  Thermometer, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  TrendingDown, 
  Radio, 
  Wind, 
  Droplet,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Wrench,
  AlertOctagon,
  Cpu,
  BookOpen,
  X,
  Layers,
  Search,
  Play,
  Pause,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  SlidersHorizontal,
  FileText
} from 'lucide-react';

interface Props {
  telemetry: TelemetryPoint;
  history: TelemetryPoint[];
  selectedSubsystem: SubsystemId | null;
  onSelectSubsystem: (sub: SubsystemId) => void;
  onOpenAIDiagnostic: () => void;
  isFaultPaused?: boolean;
  faultPausedCycle?: number;
  onResumeStream?: () => void;
  onStepForward?: () => void;
}

type TrendMetric = 'all' | 'egt' | 'ps30' | 'vibration' | 'fuelFlow';

export default function TelemetryDashboard({
  telemetry,
  history,
  selectedSubsystem,
  onSelectSubsystem,
  onOpenAIDiagnostic,
  isFaultPaused = false,
  faultPausedCycle = 0,
  onResumeStream,
  onStepForward
}: Props) {
  const [activeChartTab, setActiveChartTab] = useState<'trends' | 'radar' | 'rul'>('trends');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('all');
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState<boolean>(false);
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // Compute Focused Single-Error ML Recommendation with 15-cycle smoothing & fault latching
  const mlRec = predictEngineHealth(telemetry, history);
  const primaryFault: DetailedFaultRecommendation = mlRec.primary_fault;

  const all50Faults = getAll50Recommendations();
  const filteredCatalog = all50Faults.filter(f => 
    f.subsystem.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    f.fault_name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    f.problem.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    f.fix.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  // Radar data comparing baseline (100) vs current normalized
  const radarData = [
    {
      parameter: 'EGT (T50)',
      nominal: 100,
      current: Math.min(180, Math.max(30, (telemetry.T50 / 1404.6) * 100))
    },
    {
      parameter: 'Ps30 Press',
      nominal: 100,
      current: Math.min(180, Math.max(30, (telemetry.Ps30 / 47.47) * 100))
    },
    {
      parameter: 'N2 Core Spool',
      nominal: 100,
      current: Math.min(180, Math.max(30, (telemetry.Nc / 9050.0) * 100))
    },
    {
      parameter: 'Vibration RMS',
      nominal: 100,
      current: Math.min(250, Math.max(30, (telemetry.vibration / 0.85) * 100))
    },
    {
      parameter: 'Fuel Flow W31',
      nominal: 100,
      current: Math.min(180, Math.max(30, (telemetry.fuelFlow / 38.86) * 100))
    },
    {
      parameter: 'Oil Temp',
      nominal: 100,
      current: Math.min(180, Math.max(30, (telemetry.oilTemp / 84.5) * 100))
    }
  ];

  const chartHistoryData = history.slice(-30).map((p) => ({
    time: p.timestamp,
    egt: Number(p.egtCelsius.toFixed(1)),
    ps30: Number(p.Ps30.toFixed(2)),
    vibration: Number(p.vibration.toFixed(2)),
    fuelFlow: Number(p.fuelFlow.toFixed(2)),
    // Normalized % relative to nominal baseline (100% = baseline)
    egtNorm: Number(((p.egtCelsius / 762.0) * 100).toFixed(1)),
    ps30Norm: Number(((p.Ps30 / 47.47) * 100).toFixed(1)),
    vibNorm: Number(((p.vibration / 0.85) * 100).toFixed(1)),
    fuelNorm: Number(((p.fuelFlow / 38.86) * 100).toFixed(1)),
    health: p.healthIndex,
    rul: p.rulCycles
  }));

  const isCrit = telemetry.anomalySeverity === 'CRITICAL';
  const isWarn = telemetry.anomalySeverity === 'WARNING';
  const isAnomalous = Boolean(
    (telemetry.isAnomaly && (isCrit || isWarn || telemetry.anomalySeverity === 'ADVISORY')) ||
    isFaultPaused
  );

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 1. HIGH-PRIORITY ACTIVE ANOMALY ALERT & PAUSE BANNER (Solid Dark Red, No Glow) */}
      {isAnomalous && (
        <div className={`p-4 rounded-2xl border transition-all shadow-md flex flex-col gap-3 ${
          isCrit || isFaultPaused
            ? 'bg-red-950 border-red-800 text-red-100 animate-fade-in'
            : 'bg-amber-950 border-amber-800 text-amber-100 animate-fade-in'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-900/80 pb-2.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-800 text-white shadow-sm">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-red-300">
                    {isFaultPaused ? `DISPATCH HOLD: EXCEEDANCE AT CYCLE #${telemetry.cycle}` : 'OPERATIONAL EXCEEDANCE DETECTED'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-red-900 text-red-200 border border-red-700">
                    {primaryFault.subsystem}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-0.5 font-cinzel">
                  {primaryFault.fault_name}
                </h3>
              </div>
            </div>

            {/* Resume / Step Controls right on the Alert Card */}
            <div className="flex items-center gap-2">
              {onResumeStream && (
                <button
                  id="btn-fault-proceed"
                  onClick={onResumeStream}
                  className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-sm flex items-center gap-2 transition-all uppercase tracking-wider"
                  title="Unlock Platform & Proceed Telemetry Stream"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Resume Stream</span>
                </button>
              )}

              {onStepForward && (
                <button
                  onClick={onStepForward}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono font-semibold transition-colors"
                >
                  Step +1 Cycle
                </button>
              )}

              <button
                onClick={onOpenAIDiagnostic}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 transition-all border border-slate-700 shadow-sm"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Create Maintenance Work Order</span>
              </button>
            </div>
          </div>

          {/* Detailed Diagnosis & Single Focused Fix Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1 text-xs font-mono">
            {/* Left: Problem Root Cause (Dark Red Window) */}
            <div className="p-3.5 rounded-xl bg-red-900/60 border border-red-800 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between text-red-200 font-bold text-[11px]">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  Observed Failure Mode &amp; Physics
                </span>
                <span className="text-[10px] text-red-300">Severity: {primaryFault.severity}</span>
              </div>
              <p className="text-red-100 leading-relaxed text-xs font-sans">
                {primaryFault.problem.replace(/^\[PROBLEM\]\s*/, '')}
              </p>
              <div className="pt-1 text-[11px] text-amber-200 font-mono">
                <span className="text-red-300 block text-[10px]">Flight Deck Immediate Advisory:</span>
                {primaryFault.flight_deck_action}
              </div>
            </div>

            {/* Right: Rich Detailed FAA Fix (Dark Green Window) */}
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between text-emerald-300 font-bold text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                  Corrective Line Maintenance Action
                </span>
                <span className="text-[10px] text-emerald-200 bg-emerald-900 px-1.5 py-0.5 rounded border border-emerald-700">
                  {primaryFault.cycle_deadline}
                </span>
              </div>
              <p className="text-emerald-100 leading-relaxed text-xs font-sans font-medium">
                {primaryFault.fix.replace(/^\[DETAILED FIX\]\s*/, '').replace(/^\[FIX\]\s*/, '')}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] text-emerald-300/80 border-t border-emerald-900 mt-1">
                <div>
                  <span className="text-emerald-400 block">Inspection Protocol:</span>
                  <span className="text-emerald-100 font-medium">{primaryFault.inspection_protocol}</span>
                </div>
                <div>
                  <span className="text-emerald-400 block">Recommended Part:</span>
                  <span className="text-emerald-200 font-bold">{primaryFault.recommended_part}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. REAL-TIME HEALTH STATUS HEADER STRIP (When nominal) */}
      {!isAnomalous && (
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm transition-all flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-800 text-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase font-mono tracking-wider text-slate-500 font-semibold">
                  Turbofan Engine System #1 (ESN: 984210)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-900 text-emerald-100 border border-emerald-700 shadow-sm">
                  AIRWORTHY • NOMINAL
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-cinzel">
                Standard Cruise Envelope &amp; Balance
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] font-mono text-slate-500 block">Time to Inspection (RUL)</span>
              <div className="text-xl font-mono font-bold text-emerald-900 flex items-center justify-end gap-1.5">
                <Clock className="w-4 h-4 text-emerald-800" />
                <span>{telemetry.rulCycles} Cycles</span>
              </div>
            </div>

            <div className="text-right pr-2">
              <span className="text-[11px] font-mono text-slate-500 block">Fleet Health Index</span>
              <span className="text-xl font-mono font-bold text-emerald-900">
                {telemetry.healthIndex.toFixed(1)}%
              </span>
            </div>

            <button
              id="btn-quick-ai-diagnostic"
              onClick={onOpenAIDiagnostic}
              className="px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-sm flex items-center gap-2 transition-all"
            >
              <Activity className="w-4 h-4 text-emerald-300" />
              <span>Engineering Diagnostics</span>
            </button>
          </div>
        </div>
      )}

      {/* 2.5 ESTIMATED OPERATIONAL IMPACT FEATURE DECK */}
      <OperationalImpactSection telemetry={telemetry} />

      {/* 3. SENSOR PRIMARY GAUGES GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Gauge 1: EGT (T50) */}
        <div className="p-3.5 bg-white rounded-2xl border border-emerald-100 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Exhaust Gas (EGT)</span>
            <Flame className={`w-4 h-4 ${telemetry.egtCelsius > 800 ? 'text-rose-500 animate-pulse' : 'text-amber-500'}`} />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {telemetry.egtCelsius.toFixed(1)} <span className="text-xs font-normal text-slate-500">°C</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center justify-between">
            <span>T50: {telemetry.T50.toFixed(0)} °R</span>
            <span className={telemetry.egtCelsius > 800 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-semibold'}>
              {telemetry.egtCelsius > 800 ? 'OVER-TEMP' : 'NORMAL'}
            </span>
          </div>
        </div>

        {/* Gauge 2: Ps30 HPC Static Pressure */}
        <div className="p-3.5 bg-white rounded-2xl border border-emerald-100 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">HPC Static (Ps30)</span>
            <Gauge className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {telemetry.Ps30.toFixed(2)} <span className="text-xs font-normal text-slate-500">psia</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center justify-between">
            <span>P30: {telemetry.P30.toFixed(0)} psia</span>
            <span className={telemetry.Ps30 < 44.5 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-semibold'}>
              {telemetry.Ps30 < 44.5 ? 'LOW PRESS' : 'OPTIMAL'}
            </span>
          </div>
        </div>

        {/* Gauge 3: N2 Core Speed */}
        <div className="p-3.5 bg-white rounded-2xl border border-emerald-100 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Core Speed (N2)</span>
            <Radio className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {telemetry.Nc.toFixed(0)} <span className="text-xs font-normal text-slate-500">RPM</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center justify-between">
            <span>NRc: {telemetry.NRc.toFixed(1)}%</span>
            <span className="text-emerald-600 font-semibold">HIGH SPOOL</span>
          </div>
        </div>

        {/* Gauge 4: Total Vibration */}
        <div className="p-3.5 bg-white rounded-2xl border border-emerald-100 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Vibration (RMS)</span>
            <Zap className={`w-4 h-4 ${telemetry.vibration > 1.8 ? 'text-rose-500 animate-bounce' : 'text-emerald-600'}`} />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {telemetry.vibration.toFixed(2)} <span className="text-xs font-normal text-slate-500">mm/s</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center justify-between">
            <span>B4: {telemetry.vibB4.toFixed(2)}</span>
            <span className={telemetry.vibration > 1.8 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-semibold'}>
              {telemetry.vibration > 1.8 ? 'HIGH VIB' : 'STABLE'}
            </span>
          </div>
        </div>

        {/* Gauge 5: Fuel Flow W31 */}
        <div className="p-3.5 bg-white rounded-2xl border border-emerald-100 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Fuel Flow (W31)</span>
            <Droplet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {telemetry.fuelFlow.toFixed(2)} <span className="text-xs font-normal text-slate-500">pph</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center justify-between">
            <span>farB: {telemetry.farB.toFixed(3)}</span>
            <span className="text-emerald-600 font-semibold">NOMINAL</span>
          </div>
        </div>

        {/* Gauge 6: Oil Scavenge Temp */}
        <div className="p-3.5 bg-white rounded-2xl border border-emerald-100 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Oil Scavenge</span>
            <Thermometer className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {telemetry.oilTemp.toFixed(1)} <span className="text-xs font-normal text-slate-500">°C</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center justify-between">
            <span>Press: {telemetry.oilPress.toFixed(0)} psi</span>
            <span className={telemetry.oilTemp > 95 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-semibold'}>
              {telemetry.oilTemp > 95 ? 'HOT' : 'COOL'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. ANALYTICS TABS & DYNAMIC AUTO-SCALED CHARTS */}
      <div className="p-5 bg-white rounded-2xl border border-emerald-100 shadow-md flex flex-col gap-4">
        {/* Main Tab Controls & 50-Fault Catalog Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-mono">
            <button
              onClick={() => setActiveChartTab('trends')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeChartTab === 'trends' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Multi-Sensor Trends
            </button>
            <button
              onClick={() => setActiveChartTab('radar')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeChartTab === 'radar' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Flight Envelope Radar
            </button>
            <button
              onClick={() => setActiveChartTab('rul')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeChartTab === 'rul' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Health & RUL Degradation
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCatalogModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-mono flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
              <span>Fault Isolation Manual (FIM)</span>
            </button>
            <span className="text-xs font-mono text-slate-500">
              Sample Window: 30 Cycles • Active Cycle #{telemetry.cycle}
            </span>
          </div>
        </div>

        {/* Dynamic Metric Sub-Filter Strip (Only visible in Multi-Sensor Trends) */}
        {activeChartTab === 'trends' && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-[11px] text-slate-500 mr-1 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-emerald-600" /> Focus Parameter:
              </span>
              <button
                onClick={() => setTrendMetric('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  trendMetric === 'all' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
                }`}
              >
                All 4 (Normalized %)
              </button>
              <button
                onClick={() => setTrendMetric('egt')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  trendMetric === 'egt' ? 'bg-amber-600 text-white font-bold shadow-sm' : 'text-amber-700 hover:text-slate-900 bg-white border border-slate-200'
                }`}
              >
                <Flame className="w-3 h-3" /> EGT (°C)
              </button>
              <button
                onClick={() => setTrendMetric('ps30')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  trendMetric === 'ps30' ? 'bg-emerald-600 text-white font-bold shadow-sm' : 'text-emerald-700 hover:text-slate-900 bg-white border border-slate-200'
                }`}
              >
                <Gauge className="w-3 h-3" /> Ps30 (psia)
              </button>
              <button
                onClick={() => setTrendMetric('vibration')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  trendMetric === 'vibration' ? 'bg-rose-600 text-white font-bold shadow-sm' : 'text-rose-700 hover:text-slate-900 bg-white border border-slate-200'
                }`}
              >
                <Zap className="w-3 h-3" /> Vibration (mm/s)
              </button>
              <button
                onClick={() => setTrendMetric('fuelFlow')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  trendMetric === 'fuelFlow' ? 'bg-teal-600 text-white font-bold shadow-sm' : 'text-teal-700 hover:text-slate-900 bg-white border border-slate-200'
                }`}
              >
                <Droplet className="w-3 h-3" /> Fuel (pph)
              </button>
            </div>

            <span className="text-[10px] font-mono text-slate-500">
              {trendMetric === 'all' 
                ? 'Y-Axis: Normalized % of Baseline (100% = Nominal Baseline)' 
                : `Y-Axis: High-Resolution Real-time Telemetry Envelope`}
            </span>
          </div>
        )}

        {/* Chart Viewports with Tight Dynamic Auto-Scaling */}
        <div className="w-full h-72">
          {activeChartTab === 'trends' && (
            <ResponsiveContainer width="100%" height="100%">
              {trendMetric === 'all' ? (
                /* All 4 Normalized % with tight dynamic bounds around 100% */
                <LineChart data={chartHistoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis 
                    stroke="#64748b" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    domain={[(dataMin: number) => Math.floor(Math.max(40, dataMin - 3)), (dataMax: number) => Math.ceil(Math.min(220, dataMax + 3))]}
                    unit="%"
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '12px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} 
                    itemStyle={{ color: '#0f172a' }}
                  />
                  <Line type="monotone" dataKey="egtNorm" stroke="#d97706" name="EGT % Baseline" dot={false} strokeWidth={2.5} />
                  <Line type="monotone" dataKey="ps30Norm" stroke="#047857" name="Ps30 % Baseline" dot={false} strokeWidth={2.5} />
                  <Line type="monotone" dataKey="vibNorm" stroke="#dc2626" name="Vibration % Baseline" dot={false} strokeWidth={2.5} />
                  <Line type="monotone" dataKey="fuelNorm" stroke="#0f766e" name="Fuel Flow % Baseline" dot={false} strokeWidth={2.5} />
                </LineChart>
              ) : trendMetric === 'egt' ? (
                /* Focused Exhaust Gas Temperature (EGT) Dynamic Waveform */
                <AreaChart data={chartHistoryData}>
                  <defs>
                    <linearGradient id="colorEgt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis 
                    stroke="#64748b" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    domain={[(dataMin: number) => Math.floor(dataMin - 4), (dataMax: number) => Math.ceil(dataMax + 4)]}
                    unit="°C"
                  />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="egt" stroke="#d97706" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEgt)" name="Exhaust Gas EGT (°C)" />
                </AreaChart>
              ) : trendMetric === 'ps30' ? (
                /* Focused HPC Static Pressure Ps30 Dynamic Waveform */
                <AreaChart data={chartHistoryData}>
                  <defs>
                    <linearGradient id="colorPs30" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#047857" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#047857" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis 
                    stroke="#64748b" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    domain={[(dataMin: number) => Number((dataMin - 0.4).toFixed(1)), (dataMax: number) => Number((dataMax + 0.4).toFixed(1))]}
                    unit=" psia"
                  />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="ps30" stroke="#047857" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPs30)" name="HPC Static Pressure Ps30 (psia)" />
                </AreaChart>
              ) : trendMetric === 'vibration' ? (
                /* Focused Vibration Amplitude Dynamic Waveform */
                <AreaChart data={chartHistoryData}>
                  <defs>
                    <linearGradient id="colorVib" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis 
                    stroke="#64748b" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    domain={[(dataMin: number) => Number(Math.max(0, dataMin - 0.15).toFixed(2)), (dataMax: number) => Number((dataMax + 0.15).toFixed(2))]}
                    unit=" mm/s"
                  />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="vibration" stroke="#dc2626" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVib)" name="Vibration RMS (mm/s)" />
                </AreaChart>
              ) : (
                /* Focused Fuel Flow Dynamic Waveform */
                <AreaChart data={chartHistoryData}>
                  <defs>
                    <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis 
                    stroke="#64748b" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    domain={[(dataMin: number) => Math.floor(dataMin - 1), (dataMax: number) => Math.ceil(dataMax + 1)]}
                    unit=" pph"
                  />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="fuelFlow" stroke="#0f766e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorFuel)" name="Fuel Flow W31 (pph)" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}

          {activeChartTab === 'radar' && (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="parameter" stroke="#64748b" tick={{ fontSize: 11, fill: '#475569' }} />
                <PolarRadiusAxis angle={30} domain={[0, 200]} stroke="#cbd5e1" />
                <Radar name="Nominal Baseline" dataKey="nominal" stroke="#047857" fill="#065f46" fillOpacity={0.25} />
                <Radar name="Current Active" dataKey="current" stroke="#dc2626" fill="#ef4444" fillOpacity={0.25} />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
              </RadarChart>
            </ResponsiveContainer>
          )}

          {activeChartTab === 'rul' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartHistoryData}>
                <defs>
                  <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#047857" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#047857" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', color: '#0f172a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="health" stroke="#047857" strokeWidth={2} fillOpacity={1} fill="url(#colorHealth)" name="Health Index (%)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 5. SUBSYSTEM INTERACTIVE STATUS MATRIX */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {Object.entries(SUBSYSTEMS).map(([key, sub]) => {
          const isSelected = selectedSubsystem === key;
          const isAffected = telemetry.affectedSubsystems?.includes(key as SubsystemId) || primaryFault.subsystem.toLowerCase().includes(key);

          return (
            <button
              key={key}
              onClick={() => onSelectSubsystem(key as SubsystemId)}
              className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between gap-1.5 ${
                isSelected
                  ? 'bg-emerald-900 border-emerald-700 text-white shadow-sm ring-1 ring-emerald-500'
                  : isAffected
                    ? 'bg-red-950/90 border-red-800 text-red-200'
                    : 'bg-white border-slate-200 hover:border-emerald-700 hover:bg-emerald-50/20 text-slate-700 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono uppercase font-semibold ${isSelected ? 'text-emerald-200' : 'text-slate-500'}`}>
                  {sub.ataCode}
                </span>
                {isAffected && <ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
              </div>

              <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                {sub.name}
              </div>

              <div className="text-[10px] font-mono">
                {isAffected ? (
                  <span className="text-red-400 font-bold">DEVIATION</span>
                ) : isSelected ? (
                  <span className="text-emerald-300 font-semibold">SELECTED</span>
                ) : (
                  <span className="text-emerald-800 font-medium">NOMINAL</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 6. FAULT ISOLATION MANUAL (FIM) MODAL */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[85vh]">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl shadow-sm">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Fleet Propulsion Fault Isolation Manual (FIM / ATA 70-79)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Standard Line Maintenance Troubleshooting Protocols & Corrective Procedures
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search across 50 fleet procedures by subsystem, ATA code, symptom, or part..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none"
              />
              {catalogSearch && (
                <button
                  onClick={() => setCatalogSearch('')}
                  className="text-xs font-mono text-slate-600 hover:text-slate-900 px-2 py-1 bg-slate-200 rounded-lg"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3.5 text-xs font-mono">
              {filteredCatalog.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 hover:border-emerald-400 hover:bg-emerald-50/20 transition-colors shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 text-[10px]">
                        FIM #{item.id}
                      </span>
                      <span className="text-slate-900 font-bold">{item.fault_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[10px]">{item.subsystem}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border border-rose-200' : item.severity === 'HIGH' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {item.severity}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-rose-700 font-bold shrink-0">Symptom:</span>
                    <span className="text-slate-700">{item.problem.replace(/^\[PROBLEM\]\s*/, '')}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-emerald-800 font-bold shrink-0">Corrective Action:</span>
                    <span className="text-emerald-950 font-medium">{item.fix.replace(/^\[DETAILED FIX\]\s*/, '').replace(/^\[FIX\]\s*/, '')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
