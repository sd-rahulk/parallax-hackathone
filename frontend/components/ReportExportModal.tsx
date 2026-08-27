"use client";

import React from 'react';
import { TelemetryPoint, AnomalyEvent } from '@/types/engine';
import { calculateOperationalImpact } from '@/utils/operationalImpact';
import { 
  FileText, 
  X, 
  Download, 
  Printer, 
  Activity,
  TrendingUp,
  DollarSign
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  telemetry: TelemetryPoint;
  notifications: AnomalyEvent[];
  scenarioName: string;
}

export default function ReportExportModal({
  isOpen,
  onClose,
  telemetry,
  notifications,
  scenarioName
}: Props) {
  if (!isOpen) return null;

  const downloadJSON = () => {
    const reportObj = {
      reportType: "FAA/EASA Aircraft Engine Health & Anomaly Telemetry Report",
      generatedAt: new Date().toISOString(),
      scenario: scenarioName,
      telemetrySnapshot: telemetry,
      anomaliesDetected: notifications,
      systemHealth: {
        healthIndex: telemetry.healthIndex,
        rulCyclesRemaining: telemetry.rulCycles,
        anomalySeverity: telemetry.anomalySeverity,
        affectedSubsystems: telemetry.affectedSubsystems
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `AeroGuard_Engine_Report_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-900 text-emerald-100 rounded-2xl border border-emerald-700 shadow-sm">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-mono tracking-wider text-emerald-900 font-bold">
                EASA PART-145 / FAA AC 25-11B PROPULSION RELEASE
              </span>
              <h2 className="text-lg font-bold text-slate-900 font-cinzel">
                Aircraft Engine Health &amp; Telemetry Incident Summary
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Report Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-800">
          {/* Metadata Block */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs">
            <div>
              <span className="text-slate-500 block">Aircraft / Tail:</span>
              <span className="text-slate-900 font-bold">N782AG (B787-9)</span>
            </div>
            <div>
              <span className="text-slate-500 block">Engine Serial / Pos:</span>
              <span className="text-slate-900 font-bold">ESN-984210 / #1 PORT</span>
            </div>
            <div>
              <span className="text-slate-500 block">Logged Cycles:</span>
              <span className="text-emerald-900 font-bold">{telemetry.cycle} Cycles</span>
            </div>
            <div>
              <span className="text-slate-500 block">Report Timestamp (UTC):</span>
              <span className="text-slate-700" suppressHydrationWarning>{new Date().toUTCString()}</span>
            </div>
          </div>

          {/* Health & Anomaly Overview */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-600 flex items-center gap-2 font-cinzel">
              <Activity className="w-4 h-4 text-emerald-800" />
              Airworthiness Health Assessment &amp; Margin
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[11px] text-slate-500 block font-mono">Engine Health Index:</span>
                <span className={`text-xl font-bold font-mono ${
                  telemetry.healthIndex < 60 ? 'text-red-700' : telemetry.healthIndex < 80 ? 'text-amber-700' : 'text-emerald-900'
                }`}>
                  {telemetry.healthIndex.toFixed(1)}%
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[11px] text-slate-500 block font-mono">Remaining Useful Life:</span>
                <span className="text-xl font-bold font-mono text-emerald-900">
                  {telemetry.rulCycles} Cycles
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[11px] text-slate-500 block font-mono">Dispatch Status:</span>
                <span className={`text-sm font-bold font-mono block mt-1 ${
                  telemetry.isAnomaly ? 'text-red-700' : 'text-emerald-900'
                }`}>
                  {telemetry.isAnomaly ? `MEL RESTRICTION (${telemetry.anomalySeverity})` : 'DISPATCHABLE WITHOUT RESTRICTION'}
                </span>
              </div>
            </div>
          </div>

          {/* Full Sensor Parameter Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-600 font-cinzel">
              Recorded FADEC &amp; Telemetry Sensor Readings
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Parameter</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5">Nominal Baseline</th>
                    <th className="p-2.5">Current Value</th>
                    <th className="p-2.5">Delta / Deviation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  <tr>
                    <td className="p-2.5 font-bold text-slate-900">Nf (Fan Speed)</td>
                    <td className="p-2.5">Physical Fan Rotor Speed</td>
                    <td className="p-2.5">2,388 RPM</td>
                    <td className="p-2.5 text-emerald-900 font-bold">{telemetry.Nf.toFixed(1)} RPM</td>
                    <td className="p-2.5">{((telemetry.Nf - 2388) / 2388 * 100).toFixed(2)}%</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-slate-900">Nc (Core Speed)</td>
                    <td className="p-2.5">Physical High-Pressure Core Speed</td>
                    <td className="p-2.5">9,050 RPM</td>
                    <td className="p-2.5 text-emerald-900 font-bold">{telemetry.Nc.toFixed(1)} RPM</td>
                    <td className="p-2.5">{((telemetry.Nc - 9050) / 9050 * 100).toFixed(2)}%</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-slate-900">T50 / EGT</td>
                    <td className="p-2.5">Exhaust Gas Temperature (LPT Outlet)</td>
                    <td className="p-2.5">1,404.6 °R (762°C)</td>
                    <td className={`p-2.5 font-bold ${telemetry.egtCelsius > 800 ? 'text-red-700' : 'text-slate-900'}`}>
                      {telemetry.T50.toFixed(1)} °R ({telemetry.egtCelsius.toFixed(1)}°C)
                    </td>
                    <td className="p-2.5">{(telemetry.T50 - 1404.6).toFixed(1)} °R</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-slate-900">Ps30</td>
                    <td className="p-2.5">HPC Static Pressure at Diffuser</td>
                    <td className="p-2.5">47.47 psia</td>
                    <td className={`p-2.5 font-bold ${telemetry.Ps30 < 44.5 ? 'text-red-700' : 'text-slate-900'}`}>
                      {telemetry.Ps30.toFixed(2)} psia
                    </td>
                    <td className="p-2.5">{(telemetry.Ps30 - 47.47).toFixed(2)} psia</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-slate-900">Vibration</td>
                    <td className="p-2.5">Overall Engine Dynamic Vibration</td>
                    <td className="p-2.5">0.85 mm/s</td>
                    <td className={`p-2.5 font-bold ${telemetry.vibration > 1.8 ? 'text-red-700' : 'text-slate-900'}`}>
                      {telemetry.vibration.toFixed(2)} mm/s
                    </td>
                    <td className="p-2.5">+{(telemetry.vibration - 0.85).toFixed(2)} mm/s</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-slate-900">W31 (Fuel Flow)</td>
                    <td className="p-2.5">Mass Fuel Flow Rate</td>
                    <td className="p-2.5">38.86 pph</td>
                    <td className="p-2.5 text-slate-900 font-bold">{telemetry.fuelFlow.toFixed(2)} pph</td>
                    <td className="p-2.5">{(telemetry.fuelFlow - 38.86).toFixed(2)} pph</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Anomaly Incident Log */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-600 font-cinzel">
              Recorded Fleet Exceedances &amp; Dispatches ({notifications.length})
            </h3>
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                No exceedance thresholds breached during this sector. Engine operating within certified envelopes.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between shadow-sm">
                    <div>
                      <span className="font-bold text-slate-900">{n.title}</span>
                      <span className="text-slate-500 ml-2">({n.parameter}: {n.triggerValue} {n.unit})</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      n.severity === 'CRITICAL' ? 'bg-red-950 text-red-200 border border-red-800' : 'bg-amber-950 text-amber-200 border border-amber-800'
                    }`}>
                      {n.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Certifying Engineer Sign-Off Block */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-slate-500 block text-[10px]">Lead Propulsion Specialist:</span>
              <span className="text-slate-900 font-bold">A. Jenkins (A&amp;P License #3819402)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Maintenance Station:</span>
              <span className="text-slate-800 font-bold">MOC-SFO Line Ops</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Release Authorization:</span>
              <span className="text-emerald-900 font-bold">CERTIFIED PER PART-145</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print Certification</span>
            </button>

            <button
              onClick={downloadJSON}
              className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON Package</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
