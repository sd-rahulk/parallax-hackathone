"use client";

import React, { useState } from 'react';
import { AnomalyEvent, Severity } from '@/types/engine';
import { audioAlerts } from '@/utils/audioAlerts';
import { 
  Bell, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  X, 
  Sparkles, 
  Trash2, 
  Download, 
  ExternalLink,
  ShieldAlert,
  Flame,
  Check,
  Activity
} from 'lucide-react';

interface Props {
  notifications: AnomalyEvent[];
  activeToasts: AnomalyEvent[];
  onDismissToast: (id: string) => void;
  onAcknowledge: (id: string) => void;
  onAcknowledgeAll: () => void;
  onClearHistory: () => void;
  onOpenDiagnostic: (anomaly: AnomalyEvent) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export default function NotificationCenter({
  notifications,
  activeToasts,
  onDismissToast,
  onAcknowledge,
  onAcknowledgeAll,
  onClearHistory,
  onOpenDiagnostic,
  isMuted,
  onToggleMute
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  const unacknowledgedCount = notifications.filter(n => !n.acknowledged).length;
  const criticalCount = notifications.filter(n => n.severity === 'CRITICAL').length;
  const warningCount = notifications.filter(n => n.severity === 'WARNING').length;

  const filteredNotifications = notifications.filter(n => {
    if (filterSeverity === 'ALL') return true;
    return n.severity === filterSeverity;
  });

  const exportAlertsCSV = () => {
    if (notifications.length === 0) return;
    const headers = ["ID", "Timestamp", "Cycle", "Severity", "Subsystem", "Parameter", "Trigger Value", "Threshold", "Unit", "Title", "Description", "Acknowledged"];
    const rows = notifications.map(n => [
      n.id,
      n.formattedTime,
      n.cycle,
      n.severity,
      n.subsystem,
      `"${n.parameter}"`,
      n.triggerValue,
      n.thresholdValue,
      n.unit,
      `"${n.title}"`,
      `"${n.description.replace(/"/g, '""')}"`,
      n.acknowledged ? "YES" : "NO"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aeroguard_engine_anomalies_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Real-time Floating Toast Alert Banner Stack (Top-Right) */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
        {activeToasts.map((toast) => {
          const isCrit = toast.severity === 'CRITICAL';
          const isWarn = toast.severity === 'WARNING';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-2xl border shadow-xl backdrop-blur-xl transition-all duration-300 animate-slide-in flex flex-col gap-3 ${
                isCrit
                  ? 'bg-red-950/95 border-red-800 text-red-100'
                  : isWarn
                    ? 'bg-amber-950/95 border-amber-800 text-amber-100'
                    : 'bg-emerald-950/95 border-emerald-800 text-emerald-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl flex items-center justify-center ${
                    isCrit ? 'bg-red-800 text-white' : isWarn ? 'bg-amber-700 text-white' : 'bg-emerald-800 text-white'
                  }`}>
                    {isCrit ? <Flame className="w-5 h-5" /> : isWarn ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                        isCrit ? 'bg-red-900 text-red-200 border border-red-700' : isWarn ? 'bg-amber-900 text-amber-200 border border-amber-700' : 'bg-emerald-900 text-emerald-200'
                      }`}>
                        {toast.severity} ANOMALY
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{toast.formattedTime}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white mt-0.5 font-cinzel">
                      {toast.title}
                    </h4>
                  </div>
                </div>

                <button
                  id={`btn-dismiss-${toast.id}`}
                  onClick={() => onDismissToast(toast.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs leading-relaxed text-slate-200 pl-1">
                {toast.description}
              </p>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">{toast.parameter}:</span>
                  <span className="font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                    {toast.triggerValue} {toast.unit}
                  </span>
                  <span className="text-slate-400 text-[10px]">(Limit: {toast.thresholdValue} {toast.unit})</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id={`btn-toast-ack-${toast.id}`}
                    onClick={() => {
                      onAcknowledge(toast.id);
                      audioAlerts.playAckBeep();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1 border border-slate-700"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ack</span>
                  </button>

                  <button
                    id={`btn-toast-diag-${toast.id}`}
                    onClick={() => {
                      onOpenDiagnostic(toast);
                      onDismissToast(toast.id);
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Isolate Fault</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer Toggle Header Button & Audio Bell */}
      <div className="flex items-center gap-2">
        <button
          id="btn-toggle-sound"
          onClick={onToggleMute}
          className={`p-2.5 rounded-xl border backdrop-blur-md transition-all shadow-sm flex items-center gap-2 ${
            isMuted 
              ? 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50' 
              : 'bg-emerald-900 text-emerald-100 border-emerald-700 shadow-sm'
          }`}
          title={isMuted ? "Unmute Aural Alerts" : "Mute Aural Alerts"}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
          <span className="text-xs font-semibold hidden md:inline">{isMuted ? 'Muted' : 'Aural ON'}</span>
        </button>

        <button
          id="btn-open-notifications"
          onClick={() => setIsOpen(true)}
          className={`relative p-2.5 rounded-xl border backdrop-blur-md transition-all shadow-sm flex items-center gap-2 ${
            unacknowledgedCount > 0
              ? 'bg-red-950 text-red-200 border-red-800 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Bell className={`w-4 h-4 ${unacknowledgedCount > 0 ? 'text-red-400' : 'text-slate-600'}`} />
          <span className="text-xs font-semibold hidden sm:inline">Advisories</span>
          {unacknowledgedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-red-700 text-white min-w-[18px] text-center">
              {unacknowledgedCount}
            </span>
          )}
        </button>
      </div>

      {/* Slide-out Drawer Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white border-l border-slate-200 shadow-2xl h-full flex flex-col z-50">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-950 border border-red-800 text-red-400 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 font-cinzel">
                    MOC Alert Feed &amp; Dispatch Log
                    <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {notifications.length} Total
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time turbofan telemetry deviation &amp; exceedance feed
                  </p>
                </div>
              </div>

              <button
                id="btn-close-drawer"
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50/50 border-b border-slate-200">
              <button
                onClick={() => setFilterSeverity('ALL')}
                className={`p-2.5 rounded-xl border text-left transition-all shadow-sm ${
                  filterSeverity === 'ALL' ? 'bg-emerald-900 border-emerald-700 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`text-[10px] font-mono block ${filterSeverity === 'ALL' ? 'text-emerald-200' : 'text-slate-500'}`}>All Advisories</span>
                <span className="text-lg font-bold">{notifications.length}</span>
              </button>

              <button
                onClick={() => setFilterSeverity('CRITICAL')}
                className={`p-2.5 rounded-xl border text-left transition-all shadow-sm ${
                  filterSeverity === 'CRITICAL' ? 'bg-red-950 border-red-800 text-red-200' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`text-[10px] font-mono block font-bold ${filterSeverity === 'CRITICAL' ? 'text-red-300' : 'text-red-700'}`}>Warnings</span>
                <span className="text-lg font-bold">{criticalCount}</span>
              </button>

              <button
                onClick={() => setFilterSeverity('WARNING')}
                className={`p-2.5 rounded-xl border text-left transition-all shadow-sm ${
                  filterSeverity === 'WARNING' ? 'bg-amber-950 border-amber-800 text-amber-200' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`text-[10px] font-mono block font-bold ${filterSeverity === 'WARNING' ? 'text-amber-300' : 'text-amber-700'}`}>Cautions</span>
                <span className="text-lg font-bold">{warningCount}</span>
              </button>
            </div>

            {/* Action Bar */}
            <div className="p-3 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  id="btn-ack-all"
                  onClick={onAcknowledgeAll}
                  disabled={unacknowledgedCount === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-medium transition-colors flex items-center gap-1.5 border border-slate-200 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Acknowledge All</span>
                </button>

                <button
                  id="btn-export-csv"
                  onClick={exportAlertsCSV}
                  disabled={notifications.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-medium transition-colors flex items-center gap-1.5 border border-slate-200 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Export CSV Log</span>
                </button>
              </div>

              <button
                id="btn-clear-history"
                onClick={onClearHistory}
                disabled={notifications.length === 0}
                className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Clear Alert History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Alert List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-800 opacity-60" />
                  <p className="text-sm font-semibold text-slate-700">No active exceedances</p>
                  <p className="text-xs mt-1 text-slate-500">All engine parameters within certified envelope</p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const isCrit = notif.severity === 'CRITICAL';
                  const isWarn = notif.severity === 'WARNING';

                  return (
                    <div
                      key={notif.id}
                      className={`p-3.5 rounded-xl border transition-all shadow-sm ${
                        isCrit
                          ? 'bg-red-950 border-red-800 text-red-100'
                          : isWarn
                            ? 'bg-amber-950 border-amber-800 text-amber-100'
                            : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                            isCrit ? 'bg-red-800 text-white' : isWarn ? 'bg-amber-700 text-white' : 'bg-emerald-800 text-white'
                          }`}>
                            {notif.severity}
                          </span>
                          <span className={`text-xs font-bold ${isCrit || isWarn ? 'text-white' : 'text-slate-900'} font-cinzel`}>{notif.title}</span>
                        </div>
                        <span className={`text-[11px] font-mono ${isCrit || isWarn ? 'text-slate-300' : 'text-slate-500'}`}>{notif.formattedTime}</span>
                      </div>

                      <p className={`text-xs leading-relaxed mb-2.5 ${isCrit || isWarn ? 'text-slate-200' : 'text-slate-600'}`}>
                        {notif.description}
                      </p>

                      <div className={`flex items-center justify-between text-[11px] font-mono pt-2 border-t ${isCrit || isWarn ? 'border-slate-800' : 'border-slate-200'}`}>
                        <div className={isCrit || isWarn ? 'text-slate-300' : 'text-slate-600'}>
                          <span>{notif.parameter}: </span>
                          <span className="font-bold text-white">{notif.triggerValue} {notif.unit}</span>
                          <span className="text-slate-400 ml-1">(&gt; {notif.thresholdValue})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {!notif.acknowledged ? (
                            <button
                              onClick={() => {
                                onAcknowledge(notif.id);
                                audioAlerts.playAckBeep();
                              }}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium border border-slate-700"
                            >
                              Ack
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-sans font-medium">
                              <Check className="w-3 h-3" /> Ack'd
                            </span>
                          )}

                          <button
                            onClick={() => {
                              onOpenDiagnostic(notif);
                              setIsOpen(false);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-sans font-semibold text-[11px] flex items-center gap-1 shadow-sm border border-slate-700"
                          >
                            <Activity className="w-3 h-3 text-emerald-400" />
                            <span>Diagnostic Form</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
