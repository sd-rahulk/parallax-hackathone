export type Severity = 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'NORMAL';

export type SubsystemId = 
  | 'fan'
  | 'lpc'
  | 'hpc'
  | 'combustor'
  | 'hpt'
  | 'lpt'
  | 'nozzle'
  | 'bearings'
  | 'nacelle'
  | 'gearbox';

export interface TelemetryPoint {
  time: number;
  timestamp: string;
  cycle: number;
  
  // Rotational Speeds
  Nf: number;      // Fan Speed (Physical rpm, ~2388)
  Nc: number;      // Core Speed (Physical rpm, ~9050)
  NRf: number;     // Corrected Fan Speed (% ~100)
  NRc: number;     // Corrected Core Speed (% ~100)
  
  // Temperatures (°R / °C)
  T2: number;      // Total Temp at Fan Inlet (°R ~518.67)
  T24: number;     // Total Temp at LPC Outlet (°R ~642.5)
  T30: number;     // Total Temp at HPC Outlet (°R ~1588.2)
  T50: number;     // Total Temp at LPT Outlet / EGT (°R ~1404.6)
  egtCelsius: number; // EGT in Celsius (~762°C)
  oilTemp: number; // Oil Scavenge Temp (°C ~85°C)
  
  // Pressures (psia)
  P2: number;      // Total Press at Fan Inlet (~14.62)
  P15: number;     // Total Press in Bypass Duct (~21.61)
  P30: number;     // Total Press at HPC Outlet (~553.4)
  Ps30: number;    // Static Press at HPC Outlet (~47.47)
  oilPress: number;// Oil Pressure (psi ~55)
  pressureRatio: number; // P30 / P2 (~37.8)
  
  // Flow & Bleed
  BPR: number;     // Bypass Ratio (~8.4)
  fuelFlow: number;// Fuel Flow W31 (pph ~38.86)
  farB: number;    // Burner Fuel-Air Ratio (~0.034)
  htBleed: number; // Bleed Enthalpy (BTU/lbm ~392)
  W36: number;     // HPT Coolant Bleed (lbm/s ~38.8)
  W38: number;     // LPT Coolant Bleed (lbm/s ~23.3)
  
  // Vibration & Acoustics (mm/s RMS)
  vibration: number; // Overall Engine Vibration (~0.85 mm/s)
  vibB1: number;     // Bearing #1 Front Fan Vibration
  vibB4: number;     // Bearing #4 Hot Section Vibration
  
  // Derived Health & Anomaly
  healthIndex: number;  // 0 - 100%
  rulCycles: number;    // Remaining Useful Life in flight cycles
  anomalyScore: number; // 0 - 100%
  isAnomaly: boolean;
  anomalySeverity: Severity;
  anomalyReason?: string;
  affectedSubsystems: SubsystemId[];
}

export interface AnomalyEvent {
  id: string;
  timestamp: number;
  formattedTime: string;
  cycle: number;
  severity: Severity;
  title: string;
  description: string;
  subsystem: SubsystemId;
  parameter: string;
  triggerValue: number;
  thresholdValue: number;
  unit: string;
  acknowledged: boolean;
  flightPhase: string;
  aiDiagnostic?: AIDiagnosticResult;
}

export interface AIDiagnosticResult {
  summary: string;
  ataChapter: string;
  rootCauseAnalysis: string;
  flightDeckAction: string;
  groundMaintenanceProcedure: string[];
  recommendedParts: string[];
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  urgency: string;
  rulImpact: string;
}

export interface FlightScenario {
  id: string;
  name: string;
  category: 'Nominal' | 'NASA C-MAPSS' | 'Mechanical' | 'Aerodynamic' | 'Environmental';
  description: string;
  targetSubsystem: SubsystemId;
  expectedSeverity: Severity;
  iconName: string;
  datasetFile?: string;
  unitNumber?: string;
}

export type ViewMode = 'solid' | 'cutaway' | 'thermal' | 'wireframe' | 'exploded';

export type CameraPreset = 'iso' | 'intake' | 'side' | 'combustor' | 'turbine' | 'exhaust' | 'top';

export interface SensorHotspot {
  id: string;
  label: string;
  subsystem: SubsystemId;
  position: [number, number, number];
  sensorKey: keyof TelemetryPoint;
  format: (val: number) => string;
  unit: string;
  description: string;
}

export interface SubsystemDetail {
  id: SubsystemId;
  name: string;
  fullName: string;
  ataCode: string;
  description: string;
  nominalTempRange: string;
  nominalPressureRange: string;
  nominalRpmRange: string;
  criticalThresholds: string[];
  positionX: number; // For exploded view offset
}
