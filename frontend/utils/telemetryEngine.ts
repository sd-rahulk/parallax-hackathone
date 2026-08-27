import { 
  TelemetryPoint, 
  Severity, 
  SubsystemId, 
  AnomalyEvent, 
  FlightScenario, 
  SensorHotspot, 
  SubsystemDetail 
} from '../types/engine';
import { evaluateAutoencoderAnomaly } from './mlAutoencoder';

export const INITIAL_TELEMETRY_POINT: TelemetryPoint = {
  time: 0,
  timestamp: "12:00:00",
  cycle: 1,
  Nf: 2387.93,
  Nc: 9048.65,
  NRf: 2387.94,
  NRc: 8133.48,
  T2: 518.67,
  T24: 641.94,
  T30: 1581.93,
  T50: 1396.93,
  egtCelsius: 502.92,
  oilTemp: 82.5,
  P2: 14.62,
  P15: 21.58,
  P30: 554.56,
  Ps30: 47.09,
  oilPress: 54.8,
  pressureRatio: 37.93,
  BPR: 8.376,
  fuelFlow: 38.70,
  farB: 0.03,
  htBleed: 391.0,
  W36: 39.07,
  W38: 23.45,
  vibration: 0.82,
  vibB1: 0.45,
  vibB4: 0.55,
  healthIndex: 98.5,
  rulCycles: 150,
  anomalyScore: 4.0,
  isAnomaly: false,
  anomalySeverity: 'NORMAL',
  affectedSubsystems: []
};

// Subsystems metadata & physical properties
export const SUBSYSTEMS: Record<SubsystemId, SubsystemDetail> = {
  fan: {
    id: 'fan',
    name: 'Fan Stage',
    fullName: 'Wide-Chord Titanium Low-Pressure Fan & Spinner',
    ataCode: 'ATA 72-20',
    description: 'High-bypass titanium wide-chord fan producing 85% of total engine thrust and driving bypass duct airflow.',
    nominalTempRange: '-40°C to +45°C (T2: ~518 °R)',
    nominalPressureRange: '14.2 to 14.8 psia (P2)',
    nominalRpmRange: '2,350 - 2,420 RPM (N1)',
    criticalThresholds: ['Vibration > 2.0 mm/s', 'N1 Over-speed > 105% (2,500 RPM)', 'Blade Imbalance > 15 g·m'],
    positionX: -4.5
  },
  lpc: {
    id: 'lpc',
    name: 'Low Pressure Compressor (LPC)',
    fullName: '3-Stage Axial Low-Pressure Booster Compressor',
    ataCode: 'ATA 72-25',
    description: 'Primary core air compression booster driven by low-pressure turbine shaft, feeding the HPC.',
    nominalTempRange: '620 - 660 °R (T24)',
    nominalPressureRange: '20.5 - 22.5 psia (P24)',
    nominalRpmRange: '2,350 - 2,420 RPM (N1)',
    criticalThresholds: ['T24 Bleed Temp > 680 °R', 'Inter-stage Pressure Ratio < 1.35'],
    positionX: -2.8
  },
  hpc: {
    id: 'hpc',
    name: 'High Pressure Compressor (HPC)',
    fullName: '9-Stage Axial High-Pressure Compressor',
    ataCode: 'ATA 72-30',
    description: 'Multi-stage compressor with variable stator vanes generating extreme pressure ratio prior to combustion.',
    nominalTempRange: '1,560 - 1,610 °R (T30)',
    nominalPressureRange: '530 - 570 psia (P30)',
    nominalRpmRange: '8,950 - 9,150 RPM (N2)',
    criticalThresholds: ['Ps30 Drop > 12%', 'Surge Margin < 8%', 'T30 > 1,640 °R'],
    positionX: -0.8
  },
  combustor: {
    id: 'combustor',
    name: 'Combustor (Burner)',
    fullName: 'Annular Low-Emission Combustion Chamber',
    ataCode: 'ATA 72-40',
    description: 'Twin-annular swirl-injected combustor mixing atomized Jet-A fuel with compressed air for steady ignition.',
    nominalTempRange: '2,200 - 2,600 °R',
    nominalPressureRange: '520 - 550 psia',
    nominalRpmRange: 'N/A (Fluid flow)',
    criticalThresholds: ['Fuel-Air Ratio farB > 0.038', 'Pattern Factor Distortion > 0.28', 'Burner Acoustic Resonance'],
    positionX: 1.2
  },
  hpt: {
    id: 'hpt',
    name: 'High Pressure Turbine (HPT)',
    fullName: '2-Stage Single-Crystal Cooled High-Pressure Turbine',
    ataCode: 'ATA 72-50',
    description: 'Ultra-high temperature turbine extracting kinetic energy from combustion gases to drive the 9-stage HPC.',
    nominalTempRange: '1,380 - 1,420 °R (T50 / EGT)',
    nominalPressureRange: '180 - 210 psia',
    nominalRpmRange: '8,950 - 9,150 RPM (N2)',
    criticalThresholds: ['EGT (T50) Redline > 1,460 °R (811°C)', 'Coolant Bleed W36 < 34 lbm/s', 'Thermal Creep Accumulation'],
    positionX: 2.8
  },
  lpt: {
    id: 'lpt',
    name: 'Low Pressure Turbine (LPT)',
    fullName: '5-Stage Axial Low-Pressure Turbine',
    ataCode: 'ATA 72-55',
    description: 'Multi-stage turbine driving the fan rotor and booster compressor through the internal concentric N1 shaft.',
    nominalTempRange: '1,100 - 1,250 °R',
    nominalPressureRange: '35 - 50 psia',
    nominalRpmRange: '2,350 - 2,420 RPM (N1)',
    criticalThresholds: ['Coolant Bleed W38 < 20 lbm/s', 'Interstage Stator Wear'],
    positionX: 4.3
  },
  nozzle: {
    id: 'nozzle',
    name: 'Exhaust Nozzle & Plug',
    fullName: 'Co-Axial Mixed-Flow Variable Geometry Exhaust Nozzle',
    ataCode: 'ATA 78-10',
    description: 'Aerodynamic convergent exhaust directing bypass air and core jet streams to maximize net thrust output.',
    nominalTempRange: '450 - 650 °C',
    nominalPressureRange: '15.5 - 18.0 psia',
    nominalRpmRange: 'N/A',
    criticalThresholds: ['Exhaust Backpressure Deviation > 8%', 'Acoustic Jet Flutter'],
    positionX: 5.8
  },
  bearings: {
    id: 'bearings',
    name: 'Bearings & Shafts',
    fullName: 'Main Shaft Duplex Ball & Roller Bearings (#1 to #5)',
    ataCode: 'ATA 72-60',
    description: 'Precision pressurized oil-damped ceramic/steel bearings supporting dual concentric high & low speed spools.',
    nominalTempRange: '75 - 95 °C (Oil Scavenge)',
    nominalPressureRange: '50 - 60 psi (Oil Lube)',
    nominalRpmRange: 'Co-axial 2.4k / 9.1k RPM',
    criticalThresholds: ['Vibration Amplitude > 1.8 mm/s', 'Bearing 4 High Harmonic > 1.2g', 'Oil Delta-P > 15 psi'],
    positionX: 0.2
  },
  nacelle: {
    id: 'nacelle',
    name: 'Engine Nacelle Cowl',
    fullName: 'Acoustic Composite Nacelle & Thrust Reverser Housing',
    ataCode: 'ATA 71-10',
    description: 'Aerodynamic aerodynamic cowl containing acoustic honeycomb lining, anti-ice ducts, and bypass ducting.',
    nominalTempRange: '-50°C to +70°C',
    nominalPressureRange: 'Ambient to 22 psia',
    nominalRpmRange: 'Static structure',
    criticalThresholds: ['Cowl Latch Pressure Sensor Open', 'Anti-Ice Over-temperature'],
    positionX: 0
  },
  gearbox: {
    id: 'gearbox',
    name: 'Accessory Gearbox',
    fullName: 'Tower Shaft & High-Speed Accessory Drive Gearbox',
    ataCode: 'ATA 83-10',
    description: 'Driven by N2 shaft to power hydraulic pumps, fuel metering unit (FMU), oil scavenge pump, and starter-generator.',
    nominalTempRange: '70 - 90 °C',
    nominalPressureRange: '45 - 55 psi',
    nominalRpmRange: '12,000 RPM drive',
    criticalThresholds: ['Chip Detector Ferrous Debris Alert', 'Bevel Gear Mesh Tooth Spall'],
    positionX: -1.2
  }
};

// 3D HUD Sensor Hotspots positioned on 3D coordinates
export const SENSOR_HOTSPOTS: SensorHotspot[] = [
  {
    id: 'sensor-fan-n1',
    label: 'N1 Speed / Fan Tach',
    subsystem: 'fan',
    position: [-4.2, 1.4, 0.4],
    sensorKey: 'Nf',
    format: (v) => `${v.toFixed(0)} RPM`,
    unit: 'RPM',
    description: 'Optical multi-pole reluctance speed pickup on fan hub disc.'
  },
  {
    id: 'sensor-p30',
    label: 'Ps30 HPC Static Press',
    subsystem: 'hpc',
    position: [-0.6, 1.2, 0.7],
    sensorKey: 'Ps30',
    format: (v) => `${v.toFixed(2)} psia`,
    unit: 'psia',
    description: 'Diffuser inlet static pressure transducer critical for stall margin estimation.'
  },
  {
    id: 'sensor-t30',
    label: 'T30 HPC Exit Temp',
    subsystem: 'hpc',
    position: [-0.2, 1.1, -0.6],
    sensorKey: 'T30',
    format: (v) => `${v.toFixed(1)} °R`,
    unit: '°R',
    description: 'High-temperature dual thermocouple harness at compressor discharge.'
  },
  {
    id: 'sensor-fuel',
    label: 'Fuel Flow (W31)',
    subsystem: 'combustor',
    position: [1.2, 1.25, 0.6],
    sensorKey: 'fuelFlow',
    format: (v) => `${v.toFixed(2)} pph`,
    unit: 'pph',
    description: 'Mass Coriolis fuel flow meter inside primary fuel distribution manifold.'
  },
  {
    id: 'sensor-egt',
    label: 'EGT / T50 Exhaust Temp',
    subsystem: 'hpt',
    position: [3.2, 1.1, 0.5],
    sensorKey: 'egtCelsius',
    format: (v) => `${v.toFixed(1)} °C`,
    unit: '°C',
    description: 'Exhaust Gas Temperature thermocouple rake at LPT inlet / HPT outlet.'
  },
  {
    id: 'sensor-vib-b4',
    label: 'Vib Sensor #4 (Hot Section)',
    subsystem: 'bearings',
    position: [2.2, -1.0, 0.4],
    sensorKey: 'vibB4',
    format: (v) => `${v.toFixed(2)} mm/s`,
    unit: 'mm/s',
    description: 'Piezoelectric high-g accelerometer mounted on turbine bearing housing.'
  },
  {
    id: 'sensor-oil',
    label: 'Oil Scavenge Temp',
    subsystem: 'bearings',
    position: [-1.4, -1.2, -0.5],
    sensorKey: 'oilTemp',
    format: (v) => `${v.toFixed(1)} °C`,
    unit: '°C',
    description: 'Resistance temperature detector (RTD) in main scavenge return gallery.'
  },
  {
    id: 'sensor-bpr',
    label: 'Bypass Ratio (BPR)',
    subsystem: 'fan',
    position: [-2.2, 1.8, 0],
    sensorKey: 'BPR',
    format: (v) => `${v.toFixed(2)}`,
    unit: 'ratio',
    description: 'Mass flow calculation ratio between bypass stream and engine core.'
  }
];

// Scenarios for Mode A: Live Synthetic / Random Simulation
export const SYNTHETIC_SCENARIOS: FlightScenario[] = [
  {
    id: 'nominal_cruise',
    name: 'Nominal Steady Cruise (FL350)',
    category: 'Nominal',
    description: 'Optimal simulated cruise profile at 35,000 ft, Mach 0.82. Parameters fluctuate within 99.7% Gaussian nominal envelope.',
    targetSubsystem: 'fan',
    expectedSeverity: 'NORMAL',
    iconName: 'Plane'
  },
  {
    id: 'compressor_stall',
    name: 'Compressor Surge & Stall Precursor',
    category: 'Aerodynamic',
    description: 'Violent aerodynamic flow instability in HPC stage 6-8 with severe Ps30 pressure oscillations and acoustic surge.',
    targetSubsystem: 'hpc',
    expectedSeverity: 'CRITICAL',
    iconName: 'AlertTriangle'
  },
  {
    id: 'cmapss_fd002_hpt_thermal',
    name: 'Turbine Thermal Creep & Hot-Streak',
    category: 'Mechanical',
    description: 'Severe high-pressure turbine blade thermal barrier coating spallation with EGT spike and coolant bleed deficit.',
    targetSubsystem: 'hpt',
    expectedSeverity: 'CRITICAL',
    iconName: 'Flame'
  },
  {
    id: 'bearing_spall_oil',
    name: 'Bearing #4 Spallation & Oil Starvation',
    category: 'Mechanical',
    description: 'Fatigue pitting on hot section roller bearing race with high-frequency 3.2X harmonic vibration spike and scavenge heat.',
    targetSubsystem: 'bearings',
    expectedSeverity: 'CRITICAL',
    iconName: 'Zap'
  },
  {
    id: 'fod_bird_strike',
    name: 'Foreign Object Damage (FOD / Fan Imbalance)',
    category: 'Environmental',
    description: 'Leading edge impact on fan stage rotor blades causing instant step-jump in N1 rotational vibration.',
    targetSubsystem: 'fan',
    expectedSeverity: 'CRITICAL',
    iconName: 'ShieldAlert'
  },
  {
    id: 'cmapss_fd001_hpc_erosion',
    name: 'HPC Blade Tip Clearance Erosion',
    category: 'Mechanical',
    description: 'Progressive HPC rotor tip clearance erosion causing Ps30 drop, reduced surge margin, and efficiency degradation.',
    targetSubsystem: 'hpc',
    expectedSeverity: 'WARNING',
    iconName: 'Activity'
  },
  {
    id: 'fuel_nozzle_clog',
    name: 'Fuel Nozzle Clogging & Combustor Asymmetry',
    category: 'Mechanical',
    description: 'Partial blockage of duplex fuel spray nozzle 7 causing circumferential thermal distortion and burner flame asymmetry.',
    targetSubsystem: 'combustor',
    expectedSeverity: 'WARNING',
    iconName: 'Droplet'
  },
  {
    id: 'sensor_drift_ps30',
    name: 'Ps30 Transducer Bias & Sensor Drift',
    category: 'Mechanical',
    description: 'False telemetry anomaly induced by linear calibration degradation of static pressure transducer.',
    targetSubsystem: 'hpc',
    expectedSeverity: 'ADVISORY',
    iconName: 'Gauge'
  }
];

// Scenarios for Mode B: NASA C-MAPSS Raw Dataset Replay
export const DATASET_SCENARIOS: FlightScenario[] = [
  {
    id: 'cmapss_fd003_unit82',
    name: 'NASA C-MAPSS FD003: Unit #82 (Critical Wear Trajectory)',
    category: 'NASA C-MAPSS',
    description: 'Real raw dataset replay of Unit 82 over 194 flight cycles. High core strain and bearing stress with final RUL reaching 6 cycles.',
    targetSubsystem: 'bearings',
    expectedSeverity: 'CRITICAL',
    iconName: 'Zap',
    datasetFile: 'FD003',
    unitNumber: '82'
  },
  {
    id: 'cmapss_fd003_unit46',
    name: 'NASA C-MAPSS FD003: Unit #46 (HPC & Core Degradation)',
    category: 'NASA C-MAPSS',
    description: 'Real dataset replay of Unit 46 showing progressive compressor pressure drop Ps30 and RUL degrading to 7 cycles.',
    targetSubsystem: 'hpc',
    expectedSeverity: 'CRITICAL',
    iconName: 'Activity',
    datasetFile: 'FD003',
    unitNumber: '46'
  },
  {
    id: 'cmapss_fd003_unit39',
    name: 'NASA C-MAPSS FD003: Unit #39 (Turbine Thermal Creep)',
    category: 'NASA C-MAPSS',
    description: 'Real dataset replay of Unit 39 with EGT exhaust temperature spike, cooling bleed depletion, and RUL down to 8 cycles.',
    targetSubsystem: 'hpt',
    expectedSeverity: 'CRITICAL',
    iconName: 'Flame',
    datasetFile: 'FD003',
    unitNumber: '39'
  },
  {
    id: 'cmapss_fd003_unit1',
    name: 'NASA C-MAPSS FD003: Unit #1 (Nominal Extended Cruise)',
    category: 'Nominal',
    description: 'Real dataset replay of Unit 1 across 233 flight cycles exhibiting steady nominal performance and gradual moderate wear.',
    targetSubsystem: 'fan',
    expectedSeverity: 'NORMAL',
    iconName: 'Plane',
    datasetFile: 'FD003',
    unitNumber: '1'
  },
  {
    id: 'cmapss_fd003_unit24',
    name: 'NASA C-MAPSS FD003: Unit #24 (Rapid Turbine Degradation)',
    category: 'NASA C-MAPSS',
    description: 'Accelerated thermal degradation with single-crystal HPT nozzle erosion and RUL dropping to 9 cycles.',
    targetSubsystem: 'hpt',
    expectedSeverity: 'CRITICAL',
    iconName: 'Flame',
    datasetFile: 'FD003',
    unitNumber: '24'
  },
  {
    id: 'cmapss_fd003_unit94',
    name: 'NASA C-MAPSS FD003: Unit #94 (Compressor Stage Stall Precursor)',
    category: 'Aerodynamic',
    description: 'Aerodynamic boundary layer separation and static pressure fluctuations in Stage 7-8 HPC with RUL at 10 cycles.',
    targetSubsystem: 'hpc',
    expectedSeverity: 'CRITICAL',
    iconName: 'AlertTriangle',
    datasetFile: 'FD003',
    unitNumber: '94'
  },
  {
    id: 'cmapss_fd004_unit1',
    name: 'NASA C-MAPSS FD004: Unit #1 (Multi-Flight Envelope)',
    category: 'Environmental',
    description: 'Raw dataset replay from FD004 covering varying flight altitudes (FL100 - FL420) and complex transient power settings.',
    targetSubsystem: 'combustor',
    expectedSeverity: 'WARNING',
    iconName: 'Gauge',
    datasetFile: 'FD004',
    unitNumber: '1'
  },
  {
    id: 'cmapss_fd003_unit99',
    name: 'NASA C-MAPSS FD003: Unit #99 (Bearing Race Spallation)',
    category: 'Mechanical',
    description: 'Fatigue pitting on hot section roller bearing race with elevated harmonic vibration and scavenge heat transfer.',
    targetSubsystem: 'bearings',
    expectedSeverity: 'CRITICAL',
    iconName: 'ShieldAlert',
    datasetFile: 'FD003',
    unitNumber: '99'
  }
];

export const FLIGHT_SCENARIOS = DATASET_SCENARIOS;

// Helper to generate realistic Brownian noise
function randNoise(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stdDev;
}

// Telemetry Simulator supporting both Random Simulation & Real Dataset Replay
export class TelemetrySimulator {
  private mode: 'random' | 'dataset' = 'dataset';
  private datasetPoints: TelemetryPoint[] = [];
  private currentIndex: number = 0;
  private scenario: FlightScenario = DATASET_SCENARIOS[0];
  private stepCount: number = 0;
  private faultSeverityFactor: number = 0; // for random mode (0 to 1.0)
  private cycle: number = 0;
  private lastSeverity: Severity = 'NORMAL';

  // Baseline synthetic C-MAPSS parameters
  private baseNf = 2388.0;
  private baseNc = 9050.0;
  private baseT24 = 642.5;
  private baseT30 = 1588.2;
  private baseT50 = 1404.6;
  private baseP30 = 553.4;
  private basePs30 = 47.47;
  private baseFuelFlow = 38.86;
  private baseBPR = 8.42;
  private baseVib = 0.85;
  private baseOilTemp = 84.5;
  private baseOilPress = 54.8;
  private baseHealth = 98.5;
  private baseRul = 160;

  constructor(initialPoints?: TelemetryPoint[], initialMode: 'random' | 'dataset' = 'dataset') {
    this.mode = initialMode;
    if (initialPoints && initialPoints.length > 0) {
      this.datasetPoints = initialPoints;
    }
    this.reset();
  }

  public setMode(mode: 'random' | 'dataset') {
    this.mode = mode;
    this.reset();
  }

  public getMode(): 'random' | 'dataset' {
    return this.mode;
  }

  public setDatasetPoints(points: TelemetryPoint[]) {
    if (points && points.length > 0) {
      this.datasetPoints = points;
      this.currentIndex = 0;
      this.stepCount = 0;
    }
  }

  public getDatasetPointsCount(): number {
    return this.datasetPoints.length;
  }

  public reset() {
    this.currentIndex = 0;
    this.stepCount = 0;
    this.cycle = 1;
    this.faultSeverityFactor = 0;
    this.lastSeverity = 'NORMAL';
  }

  public setScenario(scenarioId: string) {
    const list = this.mode === 'random' ? SYNTHETIC_SCENARIOS : DATASET_SCENARIOS;
    const sc = list.find(s => s.id === scenarioId) || FLIGHT_SCENARIOS.find(s => s.id === scenarioId) || SYNTHETIC_SCENARIOS[0];
    this.scenario = sc;
    this.currentIndex = 0;
    this.stepCount = 0;
    this.cycle = 1;
    this.faultSeverityFactor = sc.id === 'nominal_cruise' ? 0 : 0.25;
    this.lastSeverity = 'NORMAL';
  }

  public getCurrentScenario(): FlightScenario {
    return this.scenario;
  }

  // Generate next continuous telemetry point (either from Real Dataset or Live Brownian Simulation)
  public nextPoint(): { point: TelemetryPoint; anomalyEvent?: AnomalyEvent } {
    this.stepCount++;

    if (this.mode === 'dataset' && this.datasetPoints.length > 0) {
      return this.nextDatasetPoint();
    } else {
      return this.nextRandomPoint();
    }
  }

  private nextDatasetPoint(): { point: TelemetryPoint; anomalyEvent?: AnomalyEvent } {
    let point = this.datasetPoints[this.currentIndex];

    // Inject live timestamp
    point = {
      ...point,
      time: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
    };

    // Advance dataset index (loop smoothly when reaching end)
    this.currentIndex++;
    if (this.currentIndex >= this.datasetPoints.length) {
      this.currentIndex = 0;
    }

    let anomalyEvent: AnomalyEvent | undefined = undefined;

    if (point.isAnomaly) {
      const primarySub = point.affectedSubsystems[0] || this.scenario.targetSubsystem || 'hpc';
      const isNewSeverity = point.anomalySeverity !== this.lastSeverity;
      const isPeriodic = this.stepCount % 20 === 0 || this.stepCount === 3;

      if (isNewSeverity || isPeriodic) {
        anomalyEvent = {
          id: `NASA-DATASET-${point.cycle}-${Date.now()}`,
          timestamp: Date.now(),
          formattedTime: new Date().toLocaleTimeString(),
          cycle: point.cycle,
          severity: point.anomalySeverity,
          title: `${this.scenario.name} (Cycle ${point.cycle})`,
          description: point.anomalyReason || `Real NASA C-MAPSS dataset anomaly on ${primarySub.toUpperCase()}. RUL: ${point.rulCycles} cycles remaining.`,
          subsystem: primarySub,
          parameter: this.getParamForSubsystem(primarySub),
          triggerValue: this.getTriggerValueForSubsystem(primarySub, point),
          thresholdValue: this.getThresholdForSubsystem(primarySub),
          unit: this.getUnitForSubsystem(primarySub),
          acknowledged: false,
          flightPhase: 'NASA C-MAPSS RAW REPLAY'
        };
      }
    }

    this.lastSeverity = point.anomalySeverity;
    return { point, anomalyEvent };
  }

  private nextRandomPoint(): { point: TelemetryPoint; anomalyEvent?: AnomalyEvent } {
    this.cycle += 1;

    if (this.scenario.id !== 'nominal_cruise') {
      this.faultSeverityFactor = Math.min(1.0, this.faultSeverityFactor + 0.018);
    } else {
      this.faultSeverityFactor = Math.max(0, this.faultSeverityFactor - 0.05);
    }

    const sev = this.faultSeverityFactor;
    const t = this.stepCount * 0.1;

    let dNf = randNoise(0, 4.0);
    let dNc = randNoise(0, 8.0);
    let dT24 = randNoise(0, 0.8);
    let dT30 = randNoise(0, 1.2);
    let dT50 = randNoise(0, 1.5);
    let dP30 = randNoise(0, 0.9);
    let dPs30 = randNoise(0, 0.08);
    let dFuel = randNoise(0, 0.15);
    let dBPR = randNoise(0, 0.02);
    let dVib = randNoise(0, 0.03);
    let dVibB1 = randNoise(0, 0.02);
    let dVibB4 = randNoise(0, 0.03);
    let dOilTemp = randNoise(0, 0.4);
    let dOilPress = randNoise(0, 0.3);

    const affectedSubsystems: SubsystemId[] = [];
    let anomalyScore = 4.0 + sev * 85;
    let anomalyReason: string | undefined = undefined;
    let pointSeverity: Severity = 'NORMAL';

    switch (this.scenario.id) {
      case 'cmapss_fd001_hpc_erosion':
        dPs30 -= sev * 4.8 + Math.sin(t * 2) * 0.4;
        dT30 += sev * 48.0;
        dT50 += sev * 32.0;
        dFuel += sev * 2.2;
        dBPR -= sev * 0.45;
        affectedSubsystems.push('hpc');
        if (sev > 0.35) {
          pointSeverity = sev > 0.75 ? 'CRITICAL' : 'WARNING';
          anomalyReason = 'High Pressure Compressor blade tip erosion detected. Ps30 static pressure dropped below 44.5 psia with elevated T30 temperature.';
        }
        break;

      case 'cmapss_fd002_hpt_thermal':
        dT50 += sev * 85.0 + Math.sin(t * 1.5) * 4.0;
        dT30 += sev * 35.0;
        dFuel += sev * 1.8;
        dVibB4 += sev * 0.9;
        affectedSubsystems.push('hpt', 'combustor');
        if (sev > 0.3) {
          pointSeverity = 'CRITICAL';
          anomalyReason = 'Turbine thermal barrier degradation & hot-streak. EGT (T50) exceeding maximum operating limit (1,480 °R / 822°C).';
        }
        break;

      case 'compressor_stall':
        dPs30 += Math.sin(t * 6.0) * (sev * 8.5) - (sev * 5.0);
        dP30 -= sev * 45.0 + Math.sin(t * 6.0) * 15.0;
        dVib += sev * 2.2 + Math.abs(Math.sin(t * 8.0)) * 1.2;
        dNc -= sev * 320.0;
        affectedSubsystems.push('hpc', 'fan');
        if (sev > 0.25) {
          pointSeverity = 'CRITICAL';
          anomalyReason = 'Compressor surge precursor: Severe static pressure oscillations and boundary layer aerodynamic separation detected in Stage 7 HPC.';
        }
        break;

      case 'bearing_spall_oil':
        dVib += sev * 2.4;
        dVibB4 += sev * 3.1 + Math.sin(t * 12.0) * 0.6;
        dOilTemp += sev * 38.0;
        dOilPress -= sev * 12.0;
        affectedSubsystems.push('bearings', 'gearbox');
        if (sev > 0.3) {
          pointSeverity = 'CRITICAL';
          anomalyReason = 'Bearing #4 race spalling detected. High-frequency vibration harmonic exceeded 2.6 mm/s with rapid oil scavenge temperature rise (+38°C).';
        }
        break;

      case 'fuel_nozzle_clog':
        dFuel -= sev * 4.5 + Math.sin(t * 3.0) * 1.2;
        dT50 += Math.sin(t * 4.0) * 22.0 * sev;
        dBPR += sev * 0.3;
        affectedSubsystems.push('combustor', 'hpt');
        if (sev > 0.35) {
          pointSeverity = 'WARNING';
          anomalyReason = 'Combustor fuel manifold asymmetry. Flow restriction detected on primary nozzle ring with exhaust temperature profile distortion.';
        }
        break;

      case 'fod_bird_strike':
        dVibB1 += (sev > 0.2 ? 2.8 : 0) + Math.sin(t * 4.0) * 0.4;
        dVib += (sev > 0.2 ? 2.1 : 0);
        dNf -= sev * 45.0;
        affectedSubsystems.push('fan', 'nacelle');
        if (sev > 0.2) {
          pointSeverity = 'CRITICAL';
          anomalyReason = 'Fan rotor dynamic imbalance. 1X rotational vibration step-increase on Bearing #1 following foreign object ingestion.';
        }
        break;

      case 'sensor_drift_ps30':
        dPs30 -= sev * 6.5;
        affectedSubsystems.push('hpc');
        if (sev > 0.4) {
          pointSeverity = 'ADVISORY';
          anomalyReason = 'Ps30 pressure sensor discrepancy: Multivariate model cross-correlation indicates transducer bias drift without aerodynamic loss.';
        }
        break;

      case 'nominal_cruise':
      default:
        pointSeverity = 'NORMAL';
        anomalyScore = Math.max(2.0, 4.0 + randNoise(0, 1.2));
        break;
    }

    const Nf = Math.max(100, this.baseNf + dNf);
    const Nc = Math.max(100, this.baseNc + dNc);
    const T24 = this.baseT24 + dT24;
    const T30 = this.baseT30 + dT30;
    const T50 = this.baseT50 + dT50;
    const P30 = this.baseP30 + dP30;
    const Ps30 = Math.max(10, this.basePs30 + dPs30);
    const fuelFlow = Math.max(10, this.baseFuelFlow + dFuel);
    const BPR = Math.max(1, this.baseBPR + dBPR);
    const vibration = Math.max(0.2, this.baseVib + dVib);
    const vibB1 = Math.max(0.1, 0.45 + dVibB1);
    const vibB4 = Math.max(0.1, 0.55 + dVibB4);
    const oilTemp = this.baseOilTemp + dOilTemp;
    const oilPress = this.baseOilPress + dOilPress;
    const egtCelsius = (T50 - 491.67) * (5 / 9);

    const healthDrop = sev * 65.0;
    const healthIndex = Math.max(5.0, Number((this.baseHealth - healthDrop + randNoise(0, 0.4)).toFixed(1)));
    const rulDrop = sev * 120.0;
    const rulCycles = Math.max(8, Math.round(this.baseRul - rulDrop));

    const isAnomaly = pointSeverity !== 'NORMAL';

    const point: TelemetryPoint = {
      time: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      cycle: Math.round(this.cycle),
      Nf,
      Nc,
      NRf: (Nf / 2388.0) * 100,
      NRc: (Nc / 9050.0) * 100,
      T2: 518.67 + randNoise(0, 0.2),
      T24,
      T30,
      T50,
      egtCelsius,
      oilTemp,
      P2: 14.62 + randNoise(0, 0.05),
      P15: 21.61 + randNoise(0, 0.1),
      P30,
      Ps30,
      oilPress,
      pressureRatio: P30 / 14.62,
      BPR,
      fuelFlow,
      farB: 0.034 + randNoise(0, 0.0005) + (sev * 0.003),
      htBleed: 392.0 + randNoise(0, 0.8),
      W36: Math.max(10, 38.86 - (sev * 6.5) + randNoise(0, 0.2)),
      W38: Math.max(10, 23.32 - (sev * 2.8) + randNoise(0, 0.1)),
      vibration,
      vibB1,
      vibB4,
      healthIndex,
      rulCycles,
      anomalyScore: Math.min(100, Math.max(0, anomalyScore)),
      isAnomaly,
      anomalySeverity: pointSeverity,
      anomalyReason,
      affectedSubsystems: isAnomaly ? affectedSubsystems : []
    };

    // Run LSTM Autoencoder ML Inference directly on current telemetry point
    const mlEval = evaluateAutoencoderAnomaly(point);
    point.healthIndex = mlEval.health_index;
    point.rulCycles = mlEval.rul_cycles;
    point.anomalyScore = mlEval.anomaly_score;

    if (mlEval.is_anomaly || point.healthIndex < 70) {
      point.isAnomaly = true;
      point.anomalySeverity = point.healthIndex < 55 || mlEval.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
      if (mlEval.affected_subsystems.length > 0) {
        point.affectedSubsystems = Array.from(new Set([...point.affectedSubsystems, ...mlEval.affected_subsystems]));
      }
    }

    let anomalyEvent: AnomalyEvent | undefined = undefined;

    if (point.isAnomaly && (this.stepCount % 12 === 0 || this.stepCount === 5)) {
      const primarySub = point.affectedSubsystems[0] || 'hpc';
      anomalyEvent = {
        id: `RAND-ANOM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: Date.now(),
        formattedTime: new Date().toLocaleTimeString(),
        cycle: Math.round(this.cycle),
        severity: pointSeverity,
        title: this.scenario.name,
        description: anomalyReason || 'Synthetic simulation deviation exceeding statistical flight envelope limit.',
        subsystem: primarySub,
        parameter: this.getParamForSubsystem(primarySub),
        triggerValue: this.getTriggerValueForSubsystem(primarySub, point),
        thresholdValue: this.getThresholdForSubsystem(primarySub),
        unit: this.getUnitForSubsystem(primarySub),
        acknowledged: false,
        flightPhase: 'SIMULATED CRUISE (FL350 / M0.82)'
      };
    }

    return { point, anomalyEvent };
  }

  private getParamForSubsystem(sub: SubsystemId): string {
    switch (sub) {
      case 'hpc': return 'Ps30 (HPC Static Press)';
      case 'hpt': return 'EGT / T50 (Exhaust Temp)';
      case 'combustor': return 'farB (Fuel-Air Ratio)';
      case 'bearings': return 'Vib #4 (Turbine Bearing)';
      case 'fan': return 'Vib #1 (Fan Imbalance)';
      default: return 'Overall Vibration';
    }
  }

  private getTriggerValueForSubsystem(sub: SubsystemId, p: TelemetryPoint): number {
    switch (sub) {
      case 'hpc': return Number(p.Ps30.toFixed(2));
      case 'hpt': return Number(p.egtCelsius.toFixed(1));
      case 'combustor': return Number(p.fuelFlow.toFixed(2));
      case 'bearings': return Number(p.vibB4.toFixed(2));
      case 'fan': return Number(p.vibB1.toFixed(2));
      default: return Number(p.vibration.toFixed(2));
    }
  }

  private getThresholdForSubsystem(sub: SubsystemId): number {
    switch (sub) {
      case 'hpc': return 45.4;
      case 'hpt': return 780.0;
      case 'combustor': return 41.5;
      case 'bearings': return 1.5;
      case 'fan': return 1.4;
      default: return 1.8;
    }
  }

  private getUnitForSubsystem(sub: SubsystemId): string {
    switch (sub) {
      case 'hpc': return 'psia';
      case 'hpt': return '°C';
      case 'combustor': return 'pph';
      case 'bearings':
      case 'fan': return 'mm/s';
      default: return 'mm/s';
    }
  }
}
