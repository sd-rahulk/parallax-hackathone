"use client";

import React, { useState } from 'react';
import { 
  X, 
  Activity, 
  AlertOctagon, 
  CheckCircle2, 
  Sliders, 
  Zap, 
  Flame, 
  RotateCcw, 
  Play, 
  Gauge, 
  Volume2, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { TelemetryPoint, SubsystemId } from '../types/engine';
import { evaluateAutoencoderAnomaly, AUTOENCODER_CONFIG } from '../utils/mlAutoencoder';
import { audioAlerts } from '../utils/audioAlerts';

interface ManualTesterProps {
  isOpen: boolean;
  onClose: () => void;
  currentTelemetry: TelemetryPoint;
  onApplyTelemetry: (point: TelemetryPoint) => void;
}

interface ManualSensors {
  egtCelsius: number;
  Ps30: number;
  T30: number;
  T50: number;
  T24: number;
  vibration: number;
  oilTemp: number;
  fuelFlow: number;
  Nf: number;
  Nc: number;
  P30: number;
}

export default function ManualAnomalyTester({
  isOpen,
  onClose,
  currentTelemetry,
  onApplyTelemetry
}: ManualTesterProps) {
  const [sensors, setSensors] = useState<ManualSensors>({
    egtCelsius: currentTelemetry.egtCelsius || 502,
    Ps30: currentTelemetry.Ps30 || 47.3,
    T30: currentTelemetry.T30 || 1585,
    T50: currentTelemetry.T50 || 1400,
    T24: currentTelemetry.T24 || 642,
    vibration: currentTelemetry.vibration || 0.82,
    oilTemp: currentTelemetry.oilTemp || 82.5,
    fuelFlow: currentTelemetry.fuelFlow || 38.8,
    Nf: currentTelemetry.Nf || 2388,
    Nc: currentTelemetry.Nc || 9050,
    P30: currentTelemetry.P30 || 554.5
  });

  const [isMuted, setIsMuted] = useState(() => audioAlerts.getMuted());

  if (!isOpen) return null;

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioAlerts.setMuted(next);
  };

  // Build temporary telemetry point from manual inputs
  const simulatedPoint: TelemetryPoint = {
    ...currentTelemetry,
    time: Date.now(),
    timestamp: new Date().toLocaleTimeString(),
    egtCelsius: sensors.egtCelsius,
    Ps30: sensors.Ps30,
    T30: sensors.T30,
    T50: sensors.T50,
    T24: sensors.T24,
    vibration: sensors.vibration,
    oilTemp: sensors.oilTemp,
    fuelFlow: sensors.fuelFlow,
    Nf: sensors.Nf,
    Nc: sensors.Nc,
    P30: sensors.P30,
    vibB1: sensors.vibration * 0.6,
    vibB4: sensors.vibration * 0.8,
    healthIndex: 100,
    anomalyScore: 0,
    isAnomaly: false,
    anomalySeverity: 'NORMAL',
    affectedSubsystems: []
  };

  // Evaluate with full_autoencoder.keras & RUL Prognostic Model
  const mlResult = evaluateAutoencoderAnomaly(simulatedPoint);
  const healthIndex = mlResult.health_index;
  const estimatedRul = mlResult.rul_cycles;
  const isAnomalous = mlResult.is_anomaly || healthIndex < 70;

  // Update input helper
  const handleInputChange = (field: keyof ManualSensors, val: number) => {
    setSensors(prev => ({
      ...prev,
      [field]: val
    }));
  };

  // Presets for presentation
  const loadPreset = (presetName: string) => {
    switch (presetName) {
      case 'nominal':
        setSensors({
          egtCelsius: 502,
          Ps30: 47.3,
          T30: 1585,
          T50: 1400,
          T24: 642,
          vibration: 0.82,
          oilTemp: 82.5,
          fuelFlow: 38.8,
          Nf: 2388,
          Nc: 9050,
          P30: 554.5
        });
        break;
      case 'egt_hotstreak':
        setSensors(prev => ({
          ...prev,
          egtCelsius: 865, // Hot-streak
          T50: 1478,
          T30: 1640,
          fuelFlow: 44.5
        }));
        break;
      case 'compressor_stall':
        setSensors(prev => ({
          ...prev,
          Ps30: 39.8, // Severe static pressure drop
          P30: 485.0,
          T30: 1675.0,
          vibration: 2.85
        }));
        break;
      case 'bearing_damage':
        setSensors(prev => ({
          ...prev,
          vibration: 3.45, // High vibration
          oilTemp: 122.0, // High scavenge temp
          Ps30: 47.1
        }));
        break;
      case 'fuel_manifold':
        setSensors(prev => ({
          ...prev,
          fuelFlow: 49.2,
          T50: 1445,
          egtCelsius: 795
        }));
        break;
    }
  };

  // Apply to Live Cockpit
  const handleApply = () => {
    const finalPoint: TelemetryPoint = {
      ...simulatedPoint,
      healthIndex: Number(healthIndex.toFixed(1)),
      rulCycles: estimatedRul,
      anomalyScore: mlResult.anomaly_score,
      isAnomaly: isAnomalous,
      anomalySeverity: healthIndex < 55 || mlResult.severity === 'CRITICAL' ? 'CRITICAL' : isAnomalous ? 'WARNING' : 'NORMAL',
      affectedSubsystems: mlResult.affected_subsystems.length > 0 ? mlResult.affected_subsystems : []
    };

    if (isAnomalous && !isMuted) {
      audioAlerts.playExceedanceAlarm();
    } else if (!isMuted) {
      audioAlerts.playAckBeep();
    }

    onApplyTelemetry(finalPoint);
    onClose();
  };

  // Test sound click
  const handleTestEvaluation = () => {
    if (isMuted) return;
    if (isAnomalous) {
      audioAlerts.playExceedanceAlarm();
    } else {
      audioAlerts.playAckBeep();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-poppins">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-900 text-white shadow-sm">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-base font-bold text-slate-900">
                  Manual ML Anomaly Tester & Injection Deck
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-200 border border-emerald-800">
                  PRESENTATION MODE
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Model: {AUTOENCODER_CONFIG.modelName} • Enter custom parameters to test real-time detection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              title={!isMuted ? "Sound Alert Enabled" : "Sound Alert Muted"}
              className={`p-2 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-colors ${
                !isMuted 
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              {!isMuted ? "ALARM ON" : "MUTED"}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Preset Buttons for Instant Presentation Demo */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              1-Click Presentation Presets:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                onClick={() => loadPreset('nominal')}
                className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 transition-all flex items-center justify-center gap-1 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Nominal Cruise
              </button>
              <button
                onClick={() => loadPreset('egt_hotstreak')}
                className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-red-950 hover:bg-red-900 text-red-200 border border-red-800 transition-all flex items-center justify-center gap-1 shadow-sm"
              >
                <Flame className="w-3.5 h-3.5 text-red-300" />
                EGT Hot-Streak
              </button>
              <button
                onClick={() => loadPreset('compressor_stall')}
                className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-red-950 hover:bg-red-900 text-red-200 border border-red-800 transition-all flex items-center justify-center gap-1 shadow-sm"
              >
                <AlertOctagon className="w-3.5 h-3.5 text-red-300" />
                HPC Stall (Ps30)
              </button>
              <button
                onClick={() => loadPreset('bearing_damage')}
                className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-red-950 hover:bg-red-900 text-red-200 border border-red-800 transition-all flex items-center justify-center gap-1 shadow-sm"
              >
                <Activity className="w-3.5 h-3.5 text-red-300" />
                Bearing Spall
              </button>
              <button
                onClick={() => loadPreset('fuel_manifold')}
                className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-amber-950 hover:bg-amber-900 text-amber-200 border border-amber-800 transition-all flex items-center justify-center gap-1 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                Fuel Asymmetry
              </button>
            </div>
          </div>

          {/* Live ML Evaluation Summary Banner */}
          <div className={`p-4 rounded-2xl border transition-all shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            isAnomalous 
              ? 'bg-red-950 border-red-800 text-red-100' 
              : 'bg-emerald-950 border-emerald-800 text-emerald-100'
          }`}>
            <div className="flex items-center gap-3.5">
              <div className={`p-3 rounded-2xl ${isAnomalous ? 'bg-red-800 text-white' : 'bg-emerald-800 text-white'}`}>
                {isAnomalous ? <AlertOctagon className="w-6 h-6 animate-pulse" /> : <CheckCircle2 className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider">
                    {isAnomalous ? 'ANOMALY DETECTED BY ML MODEL' : 'ENGINE OPERATING NOMINALLY'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    isAnomalous ? 'bg-red-900 text-red-100 border border-red-700' : 'bg-emerald-900 text-emerald-100 border border-emerald-700'
                  }`}>
                    {isAnomalous ? (healthIndex < 55 ? 'CRITICAL RISK' : 'WARNING') : 'NORMAL'}
                  </span>
                </div>
                <p className="text-sm font-cinzel font-bold text-white mt-0.5">
                  {isAnomalous 
                    ? `Affected Subsystem: ${(mlResult.affected_subsystems[0] || 'Core Engine').toUpperCase()} • Alarm Ready` 
                    : 'All parameters conform to trained autoencoder nominal flight baseline.'}
                </p>
              </div>
            </div>

            {/* Metrics pills */}
            <div className="flex items-center gap-3 font-mono">
              <div className="text-right">
                <span className="text-[10px] uppercase text-slate-300 block">ML Health Index</span>
                <span className={`text-xl font-bold ${healthIndex < 70 ? 'text-red-300' : 'text-emerald-300'}`}>
                  {healthIndex.toFixed(1)}%
                </span>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div className="text-right">
                <span className="text-[10px] uppercase text-slate-300 block">Recon MAE</span>
                <span className="text-sm font-bold text-white">
                  {mlResult.reconstruction_mae.toFixed(4)}
                </span>
              </div>
              <button
                onClick={handleTestEvaluation}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors border border-white/20 flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Test Alarm
              </button>
            </div>
          </div>

          {/* Sensor Adjustment Grid */}
          <div className="space-y-3">
            <span className="text-xs font-mono font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-700" />
              Live Sensor Input Controls:
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* EGT / T50 */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-800" />
                    Exhaust Gas Temp (T50 / EGT)
                  </span>
                  <span className={`font-bold ${sensors.egtCelsius > 800 ? 'text-red-700' : 'text-slate-900'}`}>
                    {sensors.egtCelsius} °C (Nominal ~500-750°C)
                  </span>
                </div>
                <input
                  type="range"
                  min="400"
                  max="1050"
                  step="5"
                  value={sensors.egtCelsius}
                  onChange={(e) => handleInputChange('egtCelsius', Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-800"
                />
              </div>

              {/* Ps30 HPC Static Pressure */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-800" />
                    HPC Static Press (Ps30)
                  </span>
                  <span className={`font-bold ${sensors.Ps30 < 44.0 ? 'text-red-700' : 'text-slate-900'}`}>
                    {sensors.Ps30.toFixed(1)} psia (Nominal ~47.3 psia)
                  </span>
                </div>
                <input
                  type="range"
                  min="36.0"
                  max="52.0"
                  step="0.2"
                  value={sensors.Ps30}
                  onChange={(e) => handleInputChange('Ps30', Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-800"
                />
              </div>

              {/* Vibration RMS */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-800" />
                    Turbine Vibration RMS
                  </span>
                  <span className={`font-bold ${sensors.vibration > 1.8 ? 'text-red-700' : 'text-slate-900'}`}>
                    {sensors.vibration.toFixed(2)} mm/s (Nominal ~0.82)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="4.5"
                  step="0.05"
                  value={sensors.vibration}
                  onChange={(e) => handleInputChange('vibration', Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-800"
                />
              </div>

              {/* Oil Scavenge Temp */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                    Oil Scavenge Temp
                  </span>
                  <span className={`font-bold ${sensors.oilTemp > 105 ? 'text-red-700' : 'text-slate-900'}`}>
                    {sensors.oilTemp.toFixed(1)} °C (Nominal ~82.5°C)
                  </span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="135"
                  step="1"
                  value={sensors.oilTemp}
                  onChange={(e) => handleInputChange('oilTemp', Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-800"
                />
              </div>

              {/* HPC Total Temp T30 */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-800" />
                    HPC Outlet Temp (T30)
                  </span>
                  <span className={`font-bold ${sensors.T30 > 1630 ? 'text-red-700' : 'text-slate-900'}`}>
                    {sensors.T30.toFixed(0)} °R (Nominal ~1585 °R)
                  </span>
                </div>
                <input
                  type="range"
                  min="1500"
                  max="1720"
                  step="5"
                  value={sensors.T30}
                  onChange={(e) => handleInputChange('T30', Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-800"
                />
              </div>

              {/* Fuel Flow W31 */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-800" />
                    Fuel Flow (W31 / phi)
                  </span>
                  <span className={`font-bold ${sensors.fuelFlow > 45 ? 'text-red-700' : 'text-slate-900'}`}>
                    {sensors.fuelFlow.toFixed(1)} pph (Nominal ~38.8 pph)
                  </span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="55"
                  step="0.5"
                  value={sensors.fuelFlow}
                  onChange={(e) => handleInputChange('fuelFlow', Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-800"
                />
              </div>

            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span>Current Result:</span>
            <span className={`font-bold ${isAnomalous ? 'text-red-800' : 'text-emerald-900'}`}>
              {isAnomalous ? `CRITICAL ANOMALY (Health: ${healthIndex.toFixed(0)}%)` : `HEALTHY (Health: ${healthIndex.toFixed(0)}%)`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadPreset('nominal')}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={handleApply}
              className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold text-white shadow-md flex items-center gap-2 transition-all ${
                isAnomalous
                  ? 'bg-red-950 hover:bg-red-900 border border-red-800'
                  : 'bg-emerald-900 hover:bg-emerald-800 border border-emerald-700'
              }`}
            >
              <Play className="w-4 h-4 fill-white" />
              Apply to 3D Stage & Cockpit
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
