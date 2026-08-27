"use client";

import React, { useState, useEffect } from 'react';
import { AnomalyEvent, TelemetryPoint, AIDiagnosticResult } from '@/types/engine';
import { predictEngineHealth } from '@/utils/engineRecommender';
import { 
  Sparkles, 
  X, 
  CheckCircle, 
  Wrench, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Download, 
  ShieldAlert, 
  Layers, 
  RefreshCw,
  Cpu
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  anomaly: AnomalyEvent | null;
  telemetry: TelemetryPoint;
}

export default function DiagnosticAIModal({
  isOpen,
  onClose,
  anomaly,
  telemetry
}: Props) {
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AIDiagnosticResult | null>(null);
  const [source, setSource] = useState<string>('');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAIDiagnosis();
    }
  }, [isOpen, anomaly?.id]);

  const fetchAIDiagnosis = async () => {
    setLoading(true);
    setErrorNotice(null);

    try {
      const response = await fetch('/api/gemini/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomalyData: anomaly || {
            title: telemetry.anomalyReason || 'Turbofan Telemetry Anomaly',
            severity: telemetry.anomalySeverity,
            description: telemetry.anomalyReason || 'Multi-parameter flight envelope deviation detected'
          },
          telemetrySnapshot: telemetry,
          componentName: anomaly?.subsystem ? anomaly.subsystem.toUpperCase() : 'TURBOFAN CORE'
        })
      });

      const data = await response.json();
      if (data.success && data.analysis) {
        setDiagnostic(data.analysis);
        setSource(data.source);
      } else {
        setErrorNotice(data.errorNotice || 'Failed to generate diagnostic report');
      }
    } catch (e: any) {
      console.error("Diagnostic fetch error:", e);
      setErrorNotice(e.message || 'Network error fetching diagnosis');
    } finally {
      setLoading(false);
    }
  };

  const exportWorkOrder = () => {
    if (!diagnostic) return;

    const reportText = `=====================================================
AEROGUARD 3D - FAA/EASA ENGINE MAINTENANCE WORK ORDER
=====================================================
Date: ${new Date().toISOString()}
Aircraft Engine: NASA C-MAPSS High-Bypass Turbofan Model
Subsystem: ${anomaly?.subsystem?.toUpperCase() || 'CORE'}
Severity: ${diagnostic.riskLevel} | Urgency: ${diagnostic.urgency}
ATA Chapter: ${diagnostic.ataChapter}

1. EXECUTIVE SUMMARY:
${diagnostic.summary}

2. THERMODYNAMIC ROOT CAUSE ANALYSIS:
${diagnostic.rootCauseAnalysis}

3. IMMEDIATE FLIGHT DECK ACTION:
${diagnostic.flightDeckAction}

4. GROUND MAINTENANCE ACTION PLAN (FAA CERTIFIED):
${diagnostic.groundMaintenanceProcedure.map((step, idx) => `  [ ] Step ${idx + 1}: ${step}`).join('\n')}

5. RECOMMENDED REPLACEMENT PARTS:
${diagnostic.recommendedParts.map(p => `  - ${p}`).join('\n')}

6. REMAINING USEFUL LIFE (RUL) IMPACT:
${diagnostic.rulImpact}
Current Cycle: ${telemetry.cycle} | Predicted Remaining: ${telemetry.rulCycles} Cycles

Diagnostic Source: ${source || 'C-MAPSS Aerospace Propulsion Expert System'}
=====================================================`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WorkOrder_Engine_${anomaly?.subsystem || 'Core'}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-900 border border-emerald-700 text-emerald-100 rounded-2xl shadow-sm">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold uppercase text-emerald-900">
                  Propulsion Health Diagnostic System
                </span>
                {source && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-200 text-slate-700 border border-slate-300">
                    Engine: {source}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5 font-cinzel">
                {anomaly?.title || 'Turbofan Engine Fault Isolation & Diagnostic Form'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAIDiagnosis}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Re-run Diagnostic Analysis"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-slate-800">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-emerald-800 animate-spin" />
                <Cpu className="w-8 h-8 text-emerald-800 absolute inset-0 m-auto" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 font-cinzel">Evaluating Telemetry Exceedance &amp; Maintenance Protocols...</h4>
                <p className="text-xs text-slate-500 mt-1">Cross-referencing sensor signatures with standard Propulsion Fault Isolation Manual (FIM)</p>
              </div>
            </div>
          ) : diagnostic ? (
            <>
              {/* Fault Recommender Output */}
              {(() => {
                const mlRec = predictEngineHealth(telemetry);
                const recList = mlRec.recommendations_list || [];

                return (
                  <div className="p-4 rounded-2xl bg-emerald-950/10 border border-emerald-800/40 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between border-b border-emerald-800/20 pb-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-emerald-900" />
                        <span className="text-xs font-mono font-bold text-emerald-900 uppercase tracking-wider">
                          Active Fault Isolation Procedures ({recList.length} Items)
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        mlRec.status === 'NEEDS MAINTENANCE'
                          ? 'bg-red-950 text-red-200 border-red-800'
                          : mlRec.status === 'WARNING'
                            ? 'bg-amber-950 text-amber-200 border-amber-800'
                            : 'bg-emerald-950 text-emerald-200 border-emerald-800'
                      }`}>
                        {mlRec.status} • {mlRec.affected_subsystem}
                      </span>
                    </div>

                    {/* Distinct Recommendations List */}
                    <div className="space-y-2.5">
                      {recList.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono font-bold text-slate-900 flex items-center gap-1.5 font-cinzel">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-800" />
                              FIM Protocol #{idx + 1}: {item.fault_name || item.subsystem}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {item.subsystem}
                            </span>
                          </div>

                          <div className="flex items-start gap-2 text-xs font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-red-950 border border-red-800 text-red-200 font-bold shrink-0 text-[10px]">
                              SYMPTOM
                            </span>
                            <p className="text-slate-700 leading-relaxed text-[11px]">
                              {item.problem.replace(/^\[PROBLEM\]\s*/, '')}
                            </p>
                          </div>

                          <div className="flex items-start gap-2 text-xs font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-900 border border-emerald-700 text-emerald-100 font-bold shrink-0 text-[10px]">
                              ACTION
                            </span>
                            <p className="text-emerald-950 leading-relaxed font-semibold text-[11px]">
                              {item.fix.replace(/^\[FIX\]\s*/, '')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Executive Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Engineering Assessment ({diagnostic.ataChapter})
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                    diagnostic.riskLevel === 'CRITICAL' 
                      ? 'bg-red-950 text-red-200 border border-red-800' 
                      : 'bg-amber-950 text-amber-200 border border-amber-800'
                  }`}>
                    {diagnostic.riskLevel} RISK • {diagnostic.urgency}
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed font-normal">
                  {diagnostic.summary}
                </p>
              </div>

              {/* Root Cause Physics */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-mono uppercase text-slate-500 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Thermodynamic &amp; Mechanical Root Cause
                </h4>
                <div className="p-4 rounded-2xl bg-amber-950/10 border border-amber-800/40 text-xs text-amber-950 leading-relaxed">
                  {diagnostic.rootCauseAnalysis}
                </div>
              </div>

              {/* Flight Deck In-Flight Operational Mitigation */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-mono uppercase text-slate-500 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-800" />
                  Flight Deck Advisory &amp; Operational Action
                </h4>
                <div className="p-4 rounded-2xl bg-emerald-950/10 border border-emerald-800/40 text-xs text-emerald-950 font-mono leading-relaxed">
                  {diagnostic.flightDeckAction}
                </div>
              </div>

              {/* Ground Maintenance Steps */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase text-slate-500 font-bold flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-emerald-800" />
                  Line Maintenance Action Checklist
                </h4>
                <div className="space-y-2">
                  {diagnostic.groundMaintenanceProcedure.map((step, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs">
                      <div className="w-5 h-5 rounded-full bg-emerald-800 text-white font-mono font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5 shadow-sm">
                        {idx + 1}
                      </div>
                      <span className="text-slate-700 leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Parts & RUL Impact Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <span className="text-slate-600 font-mono block font-bold">Required Line Replaceable Units (LRU):</span>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    {diagnostic.recommendedParts.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <span className="text-slate-600 font-mono block font-bold">RUL &amp; Safety Impact:</span>
                  <p className="text-slate-700 leading-relaxed">{diagnostic.rulImpact}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-500">
              <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-amber-500 opacity-60" />
              <p className="text-sm font-semibold text-slate-800 font-cinzel">Unable to load diagnostic</p>
              <p className="text-xs mt-1 text-slate-500">{errorNotice || 'Please try refreshing the diagnosis'}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors"
          >
            Close
          </button>

          <button
            onClick={exportWorkOrder}
            disabled={!diagnostic}
            className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Work Order (TXT)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
