"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { 
  TelemetryPoint, 
  SubsystemId, 
  ViewMode, 
  AnomalyEvent, 
  FlightScenario 
} from '@/types/engine';
import { 
  TelemetrySimulator, 
  SYNTHETIC_SCENARIOS,
  DATASET_SCENARIOS,
  INITIAL_TELEMETRY_POINT
} from '@/utils/telemetryEngine';
import { audioAlerts } from '@/utils/audioAlerts';
import { resetFaultLatch } from '@/utils/engineRecommender';
import TelemetryDashboard from '@/components/TelemetryDashboard';
import NotificationCenter from '@/components/NotificationCenter';
import ScenarioSelector from '@/components/ScenarioSelector';
import DiagnosticAIModal from '@/components/DiagnosticAIModal';
import ReportExportModal from '@/components/ReportExportModal';
import ManualAnomalyTester from '@/components/ManualAnomalyTester';
import { 
  Plane, 
  Sparkles, 
  FileText, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  Radio, 
  Layers,
  Database,
  Dices,
  PauseCircle,
  Sliders,
  ChevronDown,
  ArrowUp
} from 'lucide-react';

const ThreeEngineViewer = dynamic(() => import('@/components/ThreeEngineViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[640px] bg-[#060913] flex items-center justify-center text-emerald-400 font-mono text-xs">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full border-2 border-emerald-900 border-t-emerald-400 animate-spin shadow-lg shadow-emerald-500/20" />
        <span className="tracking-widest uppercase text-emerald-300">Initializing 3D Turbofan Digital Twin...</span>
      </div>
    </div>
  )
});

export default function Home() {
  const simulatorRef = useRef<TelemetrySimulator | null>(null);
  const lastAlertSeverityRef = useRef<string>('NORMAL');
  const lastAlertCycleRef = useRef<number>(-1);
  
  // Data Source Mode State: 'dataset' (real CSV) vs 'random' (dynamic Brownian sim)
  const [dataMode, setDataMode] = useState<'random' | 'dataset'>('dataset');

  // Simulation & Telemetry State
  const [telemetry, setTelemetry] = useState<TelemetryPoint>(INITIAL_TELEMETRY_POINT);
  const [history, setHistory] = useState<TelemetryPoint[]>([INITIAL_TELEMETRY_POINT]);
  const [currentScenario, setCurrentScenario] = useState<FlightScenario>(DATASET_SCENARIOS[0]);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Auto-Pause on Fault State
  const [isFaultPaused, setIsFaultPaused] = useState<boolean>(false);
  const [faultPausedCycle, setFaultPausedCycle] = useState<number>(0);

  // Dataset State
  const [currentDataset, setCurrentDataset] = useState<string>("FD003");
  const [currentUnit, setCurrentUnit] = useState<string>("82");
  const [totalCycles, setTotalCycles] = useState<number>(194);
  const [isLoadingDataset, setIsLoadingDataset] = useState<boolean>(false);

  // 3D Viewport State
  const [selectedSubsystem, setSelectedSubsystem] = useState<SubsystemId | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cutaway');
  const [explodedProgress, setExplodedProgress] = useState<number>(0.15);

  // Notifications & Alert State
  const [notifications, setNotifications] = useState<AnomalyEvent[]>([]);
  const [activeToasts, setActiveToasts] = useState<AnomalyEvent[]>([]);

  // Modals
  const [isAIDiagnosticOpen, setIsAIDiagnosticOpen] = useState<boolean>(false);
  const [diagnosticTargetAnomaly, setDiagnosticTargetAnomaly] = useState<AnomalyEvent | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isManualTesterOpen, setIsManualTesterOpen] = useState<boolean>(false);

  // Helper to load real dataset points from API
  const loadDataset = useCallback(async (file: string, unit: string) => {
    setIsLoadingDataset(true);
    try {
      const res = await fetch(`/api/dataset?file=${file}&unit=${unit}`);
      const data = await res.json();

      if (data.success && data.points && data.points.length > 0) {
        if (!simulatorRef.current) {
          simulatorRef.current = new TelemetrySimulator(data.points, 'dataset');
        } else {
          simulatorRef.current.setDatasetPoints(data.points);
        }
        setCurrentDataset(file);
        setCurrentUnit(unit);
        setTotalCycles(data.totalCycles || data.points.length);
        
        const firstPoint = data.points[0];
        setTelemetry(firstPoint);
        setHistory([firstPoint]);
        setIsFaultPaused(false);
        lastAlertSeverityRef.current = 'NORMAL';
        lastAlertCycleRef.current = -1;
      }
    } catch (err) {
      console.error("Failed to load real dataset records:", err);
    } finally {
      setIsLoadingDataset(false);
    }
  }, []);

  // Initialize on client mount
  useEffect(() => {
    if (!simulatorRef.current) {
      simulatorRef.current = new TelemetrySimulator([], 'dataset');
    }
    const initialSc = DATASET_SCENARIOS[0];
    loadDataset(initialSc.datasetFile || "FD003", initialSc.unitNumber || "82");
  }, [loadDataset]);

  // Mode Toggle Handler
  const handleToggleDataMode = (newMode: 'random' | 'dataset') => {
    setDataMode(newMode);
    setIsFaultPaused(false);
    resetFaultLatch();
    lastAlertSeverityRef.current = 'NORMAL';
    lastAlertCycleRef.current = -1;
    if (!simulatorRef.current) {
      simulatorRef.current = new TelemetrySimulator();
    }
    simulatorRef.current.setMode(newMode);
    setNotifications([]);
    setActiveToasts([]);

    if (newMode === 'dataset') {
      const sc = DATASET_SCENARIOS[0];
      setCurrentScenario(sc);
      setSelectedSubsystem(sc.targetSubsystem);
      loadDataset(sc.datasetFile || "FD003", sc.unitNumber || "82");
    } else {
      const sc = SYNTHETIC_SCENARIOS[0];
      setCurrentScenario(sc);
      setSelectedSubsystem(sc.targetSubsystem);
      setHistory([INITIAL_TELEMETRY_POINT]);
      setTelemetry(INITIAL_TELEMETRY_POINT);
    }
  };

  // Continuous Live Telemetry Streaming Loop
  useEffect(() => {
    if (!simulatorRef.current) {
      simulatorRef.current = new TelemetrySimulator();
    }
    if (!isRunning) return;

    const intervalMs = Math.max(100, 600 / simSpeed);
    const timer = setInterval(() => {
      if (!simulatorRef.current) return;
      const { point, anomalyEvent } = simulatorRef.current.nextPoint();
      
      setTelemetry(point);
      setHistory(prev => {
        const next = [...prev, point];
        return next.length > 50 ? next.slice(next.length - 50) : next;
      });

      // Synchronized Fault Detection
      const isFault = Boolean(
        (point.isAnomaly && (point.anomalySeverity === 'CRITICAL' || point.anomalySeverity === 'WARNING' || point.anomalySeverity === 'ADVISORY')) ||
        (point.healthIndex < 55)
      );

      if (isFault) {
        const shouldTriggerAlert = 
          point.anomalySeverity !== lastAlertSeverityRef.current || 
          lastAlertCycleRef.current === -1 || 
          Math.abs(point.cycle - lastAlertCycleRef.current) >= 15;

        if (shouldTriggerAlert) {
          lastAlertSeverityRef.current = point.anomalySeverity;
          lastAlertCycleRef.current = point.cycle;

          const activeEvent: AnomalyEvent = anomalyEvent || {
            id: `fault-${point.cycle}-${Date.now()}`,
            timestamp: point.time,
            formattedTime: point.timestamp,
            cycle: point.cycle,
            severity: point.healthIndex < 55 || point.anomalySeverity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
            title: `ML Anomaly Detected: ${(point.affectedSubsystems && point.affectedSubsystems[0] ? point.affectedSubsystems[0].toUpperCase() : 'Engine Exceedance')} (Health: ${point.healthIndex.toFixed(0)}%)`,
            description: point.anomalyReason || `LSTM Autoencoder reconstruction exceedance. Engine Health Index: ${point.healthIndex.toFixed(1)}%.`,
            subsystem: (point.affectedSubsystems && point.affectedSubsystems[0]) || 'hpc',
            parameter: 'EGT / Ps30',
            triggerValue: point.T30,
            thresholdValue: 1620,
            unit: '°R',
            acknowledged: false,
            flightPhase: 'Live Flight Monitoring'
          };

          setNotifications(prev => [activeEvent, ...prev.filter(n => n.id !== activeEvent.id).slice(0, 49)]);
          setActiveToasts(prev => [activeEvent, ...prev.slice(0, 1)]);

          // Focus 3D Viewport on failing subsystem
          if (activeEvent.subsystem) {
            setSelectedSubsystem(activeEvent.subsystem as SubsystemId);
          }
          if (activeEvent.severity === 'CRITICAL' || point.healthIndex < 70) {
            setExplodedProgress(0.35);
          }

          // Cockpit Alarm
          audioAlerts.playExceedanceAlarm();
        }
      } else {
        lastAlertSeverityRef.current = 'NORMAL';
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isRunning, simSpeed]);

  // Apply manual telemetry from Manual Anomaly Tester
  const handleApplyManualTelemetry = (point: TelemetryPoint) => {
    setTelemetry(point);
    setHistory(prev => [...prev.slice(-49), point]);

    if (point.isAnomaly || point.healthIndex < 70) {
      setIsRunning(false);
      setIsFaultPaused(true);
      setFaultPausedCycle(point.cycle);

      const activeEvent: AnomalyEvent = {
        id: `manual-anom-${Date.now()}`,
        timestamp: point.time,
        formattedTime: point.timestamp,
        cycle: point.cycle,
        severity: point.healthIndex < 55 || point.anomalySeverity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        title: `Manual ML Anomaly Injected: ${(point.affectedSubsystems[0] || 'Core Engine').toUpperCase()} (Health: ${point.healthIndex.toFixed(0)}%)`,
        description: `Manual sensor parameters injected. LSTM Autoencoder confirmed exceedance. Health Index: ${point.healthIndex.toFixed(1)}%.`,
        subsystem: (point.affectedSubsystems && point.affectedSubsystems[0]) || 'hpc',
        parameter: 'Manual Injection',
        triggerValue: point.egtCelsius,
        thresholdValue: 780,
        unit: '°C',
        acknowledged: false,
        flightPhase: 'MANUAL PRESENTATION INJECTION'
      };

      setNotifications(prev => [activeEvent, ...prev.filter(n => n.id !== activeEvent.id).slice(0, 49)]);
      setActiveToasts(prev => [activeEvent, ...prev.slice(0, 1)]);

      if (activeEvent.subsystem) {
        setSelectedSubsystem(activeEvent.subsystem as SubsystemId);
      }
      setExplodedProgress(0.35);
      audioAlerts.playExceedanceAlarm();
    } else {
      setIsFaultPaused(false);
      audioAlerts.playAckBeep();
    }
  };

  // Resume stream handler
  const handleResumeStream = () => {
    audioAlerts.stopAlarm();
    setIsFaultPaused(false);
    setIsRunning(true);
  };

  // Step 1 cycle forward handler
  const handleStepForward = () => {
    if (!simulatorRef.current) return;
    const { point, anomalyEvent } = simulatorRef.current.nextPoint();
    setTelemetry(point);
    setHistory(prev => {
      const next = [...prev, point];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
    if (anomalyEvent) {
      setNotifications(prev => [anomalyEvent, ...prev.slice(0, 49)]);
      setActiveToasts(prev => [anomalyEvent, ...prev.slice(0, 2)]);
    }
  };

  // Scenario Selection Handler
  const handleSelectScenario = (scenarioId: string) => {
    audioAlerts.stopAlarm();
    setIsFaultPaused(false);
    resetFaultLatch();
    lastAlertSeverityRef.current = 'NORMAL';
    lastAlertCycleRef.current = -1;
    if (!simulatorRef.current) {
      simulatorRef.current = new TelemetrySimulator();
    }
    simulatorRef.current.setScenario(scenarioId);
    
    const scList = dataMode === 'dataset' ? DATASET_SCENARIOS : SYNTHETIC_SCENARIOS;
    const sc = scList.find(s => s.id === scenarioId) || scList[0];
    setCurrentScenario(sc);
    
    // Automatically select the affected subsystem in 3D
    setSelectedSubsystem(sc.targetSubsystem);

    // If critical, set exploded view slightly open to view internal rotor/combustor
    if (sc.expectedSeverity === 'CRITICAL' && explodedProgress < 0.25) {
      setExplodedProgress(0.35);
    }

    if (dataMode === 'dataset') {
      loadDataset(sc.datasetFile || "FD003", sc.unitNumber || "82");
    }
  };

  // Custom Unit & Dataset Selector Handler
  const handleCustomUnitSelect = (datasetFile: string, unitNumber: string) => {
    audioAlerts.stopAlarm();
    setIsFaultPaused(false);
    resetFaultLatch();
    lastAlertSeverityRef.current = 'NORMAL';
    lastAlertCycleRef.current = -1;
    loadDataset(datasetFile, unitNumber);
  };

  // Reset Simulation
  const handleResetSimulation = () => {
    audioAlerts.stopAlarm();
    if (!simulatorRef.current) {
      simulatorRef.current = new TelemetrySimulator();
    }
    simulatorRef.current.reset();
    resetFaultLatch();
    lastAlertSeverityRef.current = 'NORMAL';
    lastAlertCycleRef.current = -1;
    setHistory([INITIAL_TELEMETRY_POINT]);
    setNotifications([]);
    setActiveToasts([]);
    setIsFaultPaused(false);

    if (dataMode === 'dataset') {
      const sc = currentScenario || DATASET_SCENARIOS[0];
      loadDataset(sc.datasetFile || "FD003", sc.unitNumber || "82");
    } else {
      const sc = currentScenario || SYNTHETIC_SCENARIOS[0];
      simulatorRef.current.setScenario(sc.id);
    }
  };

  // Toast & Notification handlers
  const handleDismissToast = (id: string) => {
    audioAlerts.stopAlarm();
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleAcknowledge = (id: string) => {
    audioAlerts.stopAlarm();
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, acknowledged: true } : n));
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleAcknowledgeAll = () => {
    audioAlerts.stopAlarm();
    setNotifications(prev => prev.map(n => ({ ...n, acknowledged: true })));
    setActiveToasts([]);
  };

  const handleClearHistory = () => {
    setNotifications([]);
    setActiveToasts([]);
  };

  const handleOpenAIDiagnostic = (anomaly?: AnomalyEvent) => {
    setDiagnosticTargetAnomaly(anomaly || null);
    setIsAIDiagnosticOpen(true);
  };

  const handleToggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    audioAlerts.setMuted(nextState);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Flight Operations Context Bar */}
      <div className="bg-[#060913] text-slate-400 text-[11px] font-mono px-4 lg:px-8 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">FLEET:</span>
            <span className="text-white font-bold">AeroGuard Operations</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">TAIL:</span>
            <span className="text-emerald-400 font-bold">N782AG</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-slate-500">TYPE:</span>
            <span className="text-slate-200">Boeing 787-9 (GEnx-1B)</span>
          </div>
          <span className="text-slate-700 hidden md:inline">|</span>
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-slate-500">POS:</span>
            <span className="text-slate-200">ENG 1 (PORT)</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">SECTOR:</span>
            <span className="text-slate-200">SFO &rarr; HND (FL360 / M0.84)</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ACARS LINK ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Main Cockpit / MOC Header */}
      <header className="sticky top-0 z-40 bg-[#060913]/95 backdrop-blur-xl border-b border-slate-800 px-4 lg:px-8 py-3 flex items-center justify-between shadow-xl">
        {/* Brand & Mode Identifier */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-lg border border-slate-800">
            <Plane className="w-5 h-5 -rotate-45" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5 font-cinzel">
                EngineX<span className="text-emerald-400 font-mono text-sm font-semibold">EHM</span>
              </h1>
              <span className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md border ${
                dataMode === 'dataset'
                  ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
                  : 'bg-amber-950 text-amber-200 border-amber-800'
              }`}>
                {dataMode === 'dataset' ? `TEST ASSET: ${currentDataset} (UNIT #${currentUnit})` : 'SIMULATED ENVELOPE'}
              </span>

              {isFaultPaused && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-red-950 text-red-200 border border-red-800 flex items-center gap-1 animate-pulse">
                  <PauseCircle className="w-3 h-3 text-red-400" />
                  HOLD ON EXCEEDANCE (CYCLE #{faultPausedCycle || telemetry.cycle})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Full-Scale 3D Turbofan Propulsion Digital Twin &amp; Telemetry Deck
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2.5">
          <button
            id="btn-manual-ml-tester"
            onClick={() => setIsManualTesterOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title="Manual ML Anomaly Tester & Injection Deck for Presentations"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Manual ML Test</span>
          </button>

          <button
            id="btn-open-report"
            onClick={() => setIsReportModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title="Generate Flight Certification Report"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="hidden md:inline">Flight Log Report</span>
          </button>

          <button
            id="btn-header-ai-diagnose"
            onClick={() => handleOpenAIDiagnostic()}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-md shadow-emerald-900/30 flex items-center gap-1.5 transition-all"
          >
            <Activity className="w-4 h-4 text-emerald-300" />
            <span className="hidden sm:inline">Diagnostic Analysis</span>
          </button>

          <NotificationCenter
            notifications={notifications}
            activeToasts={activeToasts}
            onDismissToast={handleDismissToast}
            onAcknowledge={handleAcknowledge}
            onAcknowledgeAll={handleAcknowledgeAll}
            onClearHistory={handleClearHistory}
            onOpenDiagnostic={handleOpenAIDiagnostic}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
          />
        </div>
      </header>

      {/* HERO SECTION: Full-Screen 3D Turbofan Digital Twin & Live HUD */}
      <section 
        id="top-hero" 
        className="relative w-full h-[calc(100vh-100px)] min-h-[640px] lg:min-h-[820px] flex flex-col bg-[#060913] overflow-hidden"
      >
        <div className="w-full h-full flex-1 relative">
          <ThreeEngineViewer
            telemetry={telemetry}
            selectedSubsystem={selectedSubsystem}
            onSelectSubsystem={(sub) => setSelectedSubsystem(sub)}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            explodedProgress={explodedProgress}
            onExplodedProgressChange={setExplodedProgress}
            isFrozen={isFaultPaused}
            onOpenAIDiagnostic={handleOpenAIDiagnostic}
          />
        </div>

        {/* Smooth Hero Down-Scroll Callout to Telemetry Deck */}
        <a
          href="#telemetry-deck"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-xl shadow-2xl text-xs font-mono flex items-center gap-2 transition-all hover:scale-105 group"
          title="Scroll to Flight Scenarios & Deep Telemetry Analytics"
        >
          <span className="text-emerald-400 font-semibold">Live Telemetry &amp; Diagnostics Deck</span>
          <ChevronDown className="w-4 h-4 text-emerald-400 group-hover:translate-y-0.5 transition-transform animate-bounce" />
        </a>
      </section>

      {/* DEEP TELEMETRY & SCENARIOS DECK */}
      <main id="telemetry-deck" className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-8 scroll-mt-16">
        {/* Section 2: NASA C-MAPSS Flight Scenario & Mode Switcher Deck */}
        <ScenarioSelector
          currentScenario={currentScenario}
          onSelectScenario={handleSelectScenario}
          onCustomUnitSelect={handleCustomUnitSelect}
          isRunning={isRunning}
          onToggleRunning={() => {
            if (isFaultPaused) {
              handleResumeStream();
            } else {
              setIsRunning(!isRunning);
            }
          }}
          onReset={handleResetSimulation}
          simSpeed={simSpeed}
          onSimSpeedChange={setSimSpeed}
          dataMode={dataMode}
          onToggleDataMode={handleToggleDataMode}
          currentDataset={currentDataset}
          currentUnit={currentUnit}
          totalCycles={totalCycles}
        />

        {/* Section 3: Real-Time Telemetry Analytics Dashboard, Focused Fix & Subsystem Matrix */}
        <TelemetryDashboard
          telemetry={telemetry}
          history={history}
          selectedSubsystem={selectedSubsystem}
          onSelectSubsystem={(sub) => setSelectedSubsystem(sub)}
          onOpenAIDiagnostic={() => handleOpenAIDiagnostic()}
          isFaultPaused={isFaultPaused}
          faultPausedCycle={faultPausedCycle}
          onResumeStream={handleResumeStream}
          onStepForward={handleStepForward}
        />
      </main>

      {/* Floating Jump-Back to Fullscreen 3D Stage */}
      <a
        href="#top-hero"
        className="fixed bottom-6 right-6 z-40 px-3.5 py-2.5 rounded-xl bg-slate-900/95 hover:bg-emerald-950 text-emerald-300 border border-emerald-500/40 backdrop-blur-xl shadow-2xl text-xs font-mono flex items-center gap-2 transition-all hover:scale-105 group"
        title="Return to full-screen 3D Turbofan Stage"
      >
        <Plane className="w-4 h-4 text-emerald-400 -rotate-45 group-hover:rotate-0 transition-transform" />
        <span className="hidden sm:inline font-semibold">3D Engine Stage</span>
        <ArrowUp className="w-3.5 h-3.5 text-emerald-400 group-hover:-translate-y-0.5 transition-transform" />
      </a>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500 font-mono flex flex-wrap items-center justify-between gap-2">
        <span>AeroGuard Engine Health Monitoring System • Version 4.2.1-REL</span>
        <span>Standard Operating Limits Certified per FAA AC 25-11B / EASA Part-M</span>
        <span>Maintenance Operations Center (MOC) Fleet Link</span>
      </footer>

      {/* Modals */}
      <ManualAnomalyTester
        isOpen={isManualTesterOpen}
        onClose={() => setIsManualTesterOpen(false)}
        currentTelemetry={telemetry}
        onApplyTelemetry={handleApplyManualTelemetry}
      />

      <DiagnosticAIModal
        isOpen={isAIDiagnosticOpen}
        onClose={() => setIsAIDiagnosticOpen(false)}
        anomaly={diagnosticTargetAnomaly}
        telemetry={telemetry}
      />

      <ReportExportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        telemetry={telemetry}
        notifications={notifications}
        scenarioName={`${currentScenario.name} (${dataMode === 'dataset' ? `Dataset ${currentDataset} - Unit #${currentUnit}` : 'Random Simulation Mode'})`}
      />
    </div>
  );
}
