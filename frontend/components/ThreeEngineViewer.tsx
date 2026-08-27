import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  TelemetryPoint, 
  SubsystemId, 
  ViewMode, 
  CameraPreset, 
  SensorHotspot,
  AnomalyEvent
} from '../types/engine';
import { SUBSYSTEMS, SENSOR_HOTSPOTS } from '../utils/telemetryEngine';
import { 
  Maximize2, 
  Minimize2,
  RotateCw, 
  Flame, 
  Layers, 
  Eye, 
  Crosshair, 
  Sparkles, 
  Gauge, 
  AlertCircle,
  HelpCircle,
  Activity,
  Zap,
  Sliders,
  ChevronDown,
  X,
  Radio,
  Plane,
  TrendingUp,
  Info,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

interface Props {
  telemetry: TelemetryPoint;
  selectedSubsystem: SubsystemId | null;
  onSelectSubsystem: (sub: SubsystemId | null) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  explodedProgress: number; // 0 to 1
  onExplodedProgressChange: (val: number) => void;
  isFrozen?: boolean;
  onOpenAIDiagnostic?: (anomaly?: AnomalyEvent) => void;
}

export default function ThreeEngineViewer({
  telemetry,
  selectedSubsystem,
  onSelectSubsystem,
  viewMode,
  onViewModeChange,
  explodedProgress,
  onExplodedProgressChange,
  isFrozen = false,
  onOpenAIDiagnostic
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // Animation state refs
  const rotGroupsRef = useRef<{
    n1Rotor: THREE.Group;
    n2Rotor: THREE.Group;
    fanRotor: THREE.Group;
  } | null>(null);
  
  const explodedGroupsRef = useRef<Record<SubsystemId, THREE.Group>>({} as any);
  const particlesRef = useRef<THREE.Points | null>(null);
  const flameLightRef = useRef<THREE.PointLight | null>(null);
  const anomalyGlowLightsRef = useRef<Record<string, THREE.PointLight>>({});
  const materialsRef = useRef<Record<string, THREE.Material>>({});

  const [autoRotate, setAutoRotate] = useState(false);
  const [showAirflow, setShowAirflow] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [hoveredHotspot, setHoveredHotspot] = useState<SensorHotspot | null>(null);
  const [screenCoords, setScreenCoords] = useState<Record<string, { x: number; y: number; visible: boolean }>>({});

  // 3D Scene Initialization
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913); // Deep aerospace cockpit slate
    scene.fog = new THREE.FogExp2(0x060913, 0.035);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(10, 6, 12);
    cameraRef.current = camera;

    // WebGL Renderer with High Dynamic Range & Anti-aliasing
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      powerPreference: "high-performance",
      alpha: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 35;
    controls.minDistance = 2.5;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xdde5ff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(15, 20, 15);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x4488ff, 1.2);
    dirLight2.position.set(-15, -10, -15);
    scene.add(dirLight2);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 1.8);
    rimLight.position.set(0, 15, -10);
    scene.add(rimLight);

    // Dynamic Flame Light inside Combustor
    const flameLight = new THREE.PointLight(0xff6600, 3.5, 8);
    flameLight.position.set(1.2, 0, 0);
    scene.add(flameLight);
    flameLightRef.current = flameLight;

    // Grid Floor
    const grid = new THREE.GridHelper(40, 40, 0x1e3a5f, 0x0c1a2f);
    grid.position.y = -3.8;
    scene.add(grid);

    // Build Procedural 3D Turbofan Model
    const { groups, rotators, materials } = buildEngineGeometry(scene);
    explodedGroupsRef.current = groups;
    rotGroupsRef.current = rotators;
    materialsRef.current = materials;

    // Build Airflow Particle System
    const particleSystem = buildAirflowParticles(scene);
    particlesRef.current = particleSystem;

    // Window Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0] || !mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const { width: newW, height: newH } = entries[0].contentRect;
      if (newW > 0 && newH > 0) {
        cameraRef.current.aspect = newW / newH;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(newW, newH);
      }
    });
    resizeObserver.observe(container);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Rotate Spools based on N1 & N2 speeds
      if (rotGroupsRef.current) {
        // N1 spool (Fan, LPC, LPT)
        const n1Speed = 0.08 * (telemetry.Nf / 2388.0);
        rotGroupsRef.current.fanRotor.rotation.x += n1Speed;
        rotGroupsRef.current.n1Rotor.rotation.x += n1Speed;

        // N2 spool (HPC, HPT)
        const n2Speed = 0.16 * (telemetry.Nc / 9050.0);
        rotGroupsRef.current.n2Rotor.rotation.x += n2Speed;
      }

      // Combustor Flame flicker
      if (flameLightRef.current) {
        flameLightRef.current.intensity = 2.8 + Math.sin(elapsedTime * 18.0) * 0.8 + Math.cos(elapsedTime * 27.0) * 0.4;
      }

      // Update Airflow Particles
      if (particlesRef.current && showAirflow) {
        const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
        const count = positions.length / 3;
        const speed = 0.08 * (telemetry.Nf / 2388.0);

        for (let i = 0; i < count; i++) {
          const idx = i * 3;
          positions[idx] += speed; // Move along X-axis (engine axis)

          // Reset particle if reached end of exhaust
          if (positions[idx] > 8.5) {
            positions[idx] = -6.5; // Re-enter at intake
          }
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Controls update
      if (controlsRef.current) {
        if (autoRotate) {
          controlsRef.current.autoRotate = true;
          controlsRef.current.autoRotateSpeed = 1.2;
        } else {
          controlsRef.current.autoRotate = false;
        }
        controlsRef.current.update();
      }

      // Render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (rendererRef.current && rendererRef.current.domElement) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Update Exploded View translation offsets smoothly
  useEffect(() => {
    if (!explodedGroupsRef.current) return;
    const progress = explodedProgress;

    // Fan translates left
    if (explodedGroupsRef.current.fan) {
      explodedGroupsRef.current.fan.position.x = -progress * 3.5;
    }
    // LPC translates slightly left
    if (explodedGroupsRef.current.lpc) {
      explodedGroupsRef.current.lpc.position.x = -progress * 2.0;
    }
    // HPC separates slightly
    if (explodedGroupsRef.current.hpc) {
      explodedGroupsRef.current.hpc.position.x = -progress * 0.8;
    }
    // Combustor stays near center
    if (explodedGroupsRef.current.combustor) {
      explodedGroupsRef.current.combustor.position.x = progress * 0.4;
    }
    // HPT translates right
    if (explodedGroupsRef.current.hpt) {
      explodedGroupsRef.current.hpt.position.x = progress * 1.8;
    }
    // LPT translates further right
    if (explodedGroupsRef.current.lpt) {
      explodedGroupsRef.current.lpt.position.x = progress * 3.2;
    }
    // Exhaust Nozzle translates far right
    if (explodedGroupsRef.current.nozzle) {
      explodedGroupsRef.current.nozzle.position.x = progress * 4.8;
    }
    // Nacelle splits top/bottom or expands radially
    if (explodedGroupsRef.current.nacelle) {
      explodedGroupsRef.current.nacelle.position.y = progress * 2.5;
      explodedGroupsRef.current.nacelle.scale.set(
        1 + progress * 0.2,
        1 + progress * 0.2,
        1 + progress * 0.2
      );
    }
  }, [explodedProgress]);

  // Update Materials according to ViewMode & Anomaly Status
  useEffect(() => {
    if (!materialsRef.current) return;

    const mats = materialsRef.current;
    const isThermal = viewMode === 'thermal';
    const isWireframe = viewMode === 'wireframe';
    const isCutaway = viewMode === 'cutaway';

    Object.keys(mats).forEach((key) => {
      const mat = mats[key] as THREE.MeshStandardMaterial;
      if (!mat) return;

      mat.wireframe = isWireframe;

      // Handle Nacelle transparency
      if (key === 'nacelle') {
        if (isCutaway) {
          mat.opacity = 0.25;
          mat.transparent = true;
          mat.roughness = 0.1;
          mat.metalness = 0.9;
        } else if (isWireframe) {
          mat.opacity = 0.4;
          mat.transparent = true;
        } else {
          mat.opacity = 0.85;
          mat.transparent = false;
        }
      }

      // Check if subsystem has active anomaly
      const isAffected = telemetry.affectedSubsystems.includes(key as SubsystemId) || selectedSubsystem === key;
      
      if (isAffected && telemetry.isAnomaly) {
        mat.emissive = new THREE.Color(
          telemetry.anomalySeverity === 'CRITICAL' ? 0xff0033 : 0xffaa00
        );
        mat.emissiveIntensity = 0.8 + Math.sin(Date.now() * 0.005) * 0.4;
      } else if (isThermal) {
        // Thermal Heatmap coloring based on Brayton Cycle
        const thermalColors: Record<string, number> = {
          fan: 0x00ccff,       // T2 Cool blue
          lpc: 0x00ffaa,       // T24 Sky green
          hpc: 0xffaa00,       // T30 High amber
          combustor: 0xff1100, // Fiery red
          hpt: 0xff3300,       // T50 Hot orange-red
          lpt: 0xff7700,       // Medium orange
          nozzle: 0xcc4400,    // Exhaust red
          bearings: 0x9933ff,  // High temp purple
          nacelle: 0x113355,   // Outer shell
          gearbox: 0x00bbdd
        };
        mat.color = new THREE.Color(thermalColors[key] || 0x4488aa);
        mat.emissive = new THREE.Color(thermalColors[key] || 0x000000);
        mat.emissiveIntensity = 0.35;
      } else {
        // Standard high-tech titanium / aerospace metal palette
        const standardColors: Record<string, number> = {
          fan: 0xb8c4d4,       // Polished Titanium
          lpc: 0x94a3b8,       // Satin Steel
          hpc: 0x64748b,       // Nickel-Chromium
          combustor: 0x334155, // Inconel Ceramic
          hpt: 0xc27803,       // Thermal Coated Gold-Bronze
          lpt: 0x85929e,       // High Temp Alloy
          nozzle: 0x273746,    // Carbon Composite Nozzle
          bearings: 0xd4af37,  // Brass/Gold Bearings
          nacelle: 0x1e293b,   // Dark Aerospace Composite
          gearbox: 0x475569
        };
        mat.color = new THREE.Color(standardColors[key] || 0x888888);
        mat.emissive = new THREE.Color(selectedSubsystem === key ? 0x00ffff : 0x000000);
        mat.emissiveIntensity = selectedSubsystem === key ? 0.3 : 0.0;
      }
      mat.needsUpdate = true;
    });
  }, [viewMode, telemetry.affectedSubsystems, telemetry.anomalySeverity, telemetry.isAnomaly, selectedSubsystem]);

  // Project 3D Hotspots to 2D Screen Coordinates for HUD Overlays
  useEffect(() => {
    if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
    const interval = setInterval(() => {
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      if (!camera || !renderer) return;

      const newCoords: Record<string, { x: number; y: number; visible: boolean }> = {};
      const width = renderer.domElement.clientWidth;
      const height = renderer.domElement.clientHeight;

      SENSOR_HOTSPOTS.forEach((spot) => {
        // Compute position with exploded offset
        let posX = spot.position[0];
        const sub = spot.subsystem;
        if (explodedGroupsRef.current[sub]) {
          posX += explodedGroupsRef.current[sub].position.x;
        }

        const v = new THREE.Vector3(posX, spot.position[1], spot.position[2]);
        v.project(camera);

        const isBehind = v.z > 1;
        const x = (v.x * 0.5 + 0.5) * width;
        const y = -(v.y * 0.5 - 0.5) * height;

        newCoords[spot.id] = {
          x,
          y,
          visible: !isBehind && x > 20 && x < width - 20 && y > 20 && y < height - 20
        };
      });

      setScreenCoords(newCoords);
    }, 50);

    return () => clearInterval(interval);
  }, [explodedProgress]);

  // Fullscreen state & handler
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    const elem = document.getElementById('three-engine-container');
    if (!elem) return;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request error:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen error:', err);
      });
    }
  };

  // Focus camera smoothly on a specific subsystem
  const focusSubsystem = (sub: SubsystemId | null) => {
    onSelectSubsystem(sub);
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (!sub) {
      setCameraView('iso');
      return;
    }

    const subTargets: Partial<Record<SubsystemId, { pos: [number, number, number]; lookAt: [number, number, number] }>> = {
      fan: { pos: [-8.5, 2.2, 5.8], lookAt: [-4.5, 0, 0] },
      lpc: { pos: [-6.0, 1.8, 5.0], lookAt: [-2.8, 0, 0] },
      hpc: { pos: [-2.5, 2.0, 4.8], lookAt: [-0.8, 0, 0] },
      combustor: { pos: [1.2, 2.4, 4.2], lookAt: [1.2, 0, 0] },
      hpt: { pos: [3.8, 2.0, 4.5], lookAt: [2.8, 0, 0] },
      lpt: { pos: [5.6, 2.2, 5.0], lookAt: [4.1, 0, 0] },
      nozzle: { pos: [8.5, 2.0, 5.2], lookAt: [5.8, 0, 0] },
      bearings: { pos: [0, 3.2, 6.5], lookAt: [0, 0, 0] },
      nacelle: { pos: [0, 4.0, 11.5], lookAt: [0, 0, 0] },
      gearbox: { pos: [-2.0, -1.0, 5.5], lookAt: [-1.5, -2, 0] }
    };

    const target = subTargets[sub];
    if (target) {
      const startPos = camera.position.clone();
      const endPos = new THREE.Vector3(...target.pos);
      const startLook = controls.target.clone();
      const endLook = new THREE.Vector3(...target.lookAt);

      let startTime = performance.now();
      const duration = 750;

      const updateCam = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        camera.position.lerpVectors(startPos, endPos, ease);
        controls.target.lerpVectors(startLook, endLook, ease);
        controls.update();

        if (t < 1) {
          requestAnimationFrame(updateCam);
        }
      };
      requestAnimationFrame(updateCam);
    }
  };

  // Camera presets transition
  const setCameraView = (preset: CameraPreset) => {
    setCameraPreset(preset);
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    const targets: Record<CameraPreset, { pos: [number, number, number]; lookAt: [number, number, number] }> = {
      iso: { pos: [10, 6, 12], lookAt: [0, 0, 0] },
      intake: { pos: [-12, 1.5, 0.1], lookAt: [-4, 0, 0] },
      side: { pos: [0, 1.5, 14], lookAt: [0, 0, 0] },
      combustor: { pos: [2.5, 3.5, 4.5], lookAt: [1.2, 0, 0] },
      turbine: { pos: [5.5, 2.5, 5.0], lookAt: [3.5, 0, 0] },
      exhaust: { pos: [13, 2, 0.1], lookAt: [5.5, 0, 0] },
      top: { pos: [0, 16, 0.1], lookAt: [0, 0, 0] }
    };

    const target = targets[preset];
    if (target) {
      const startPos = camera.position.clone();
      const endPos = new THREE.Vector3(...target.pos);
      const startLook = controls.target.clone();
      const endLook = new THREE.Vector3(...target.lookAt);

      let startTime = performance.now();
      const duration = 800;

      const updateCam = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        camera.position.lerpVectors(startPos, endPos, ease);
        controls.target.lerpVectors(startLook, endLook, ease);
        controls.update();

        if (t < 1) {
          requestAnimationFrame(updateCam);
        }
      };
      requestAnimationFrame(updateCam);
    }
  };

  const isCritical = telemetry.anomalySeverity === 'CRITICAL' || telemetry.healthIndex < 55;
  const isWarning = telemetry.anomalySeverity === 'WARNING' || telemetry.healthIndex < 75;

  return (
    <div 
      id="three-engine-container" 
      className={`relative w-full h-full min-h-[640px] lg:min-h-[780px] bg-[#060913] overflow-hidden select-none flex flex-col transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : 'rounded-none border-0'
      }`}
    >
      {/* 3D Canvas Mount Point */}
      <div 
        ref={mountRef} 
        className="w-full h-full flex-1 cursor-grab active:cursor-grabbing relative"
      />

      {/* 3D HUD Sensor Pins Overlay */}
      {showHotspots && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {SENSOR_HOTSPOTS.map((spot) => {
            const coords = screenCoords[spot.id];
            if (!coords || !coords.visible) return null;

            const isAffected = telemetry.affectedSubsystems.includes(spot.subsystem);
            const isSelected = selectedSubsystem === spot.subsystem;
            const currentVal = telemetry[spot.sensorKey] as number;
            const formattedVal = spot.format(currentVal);

            return (
              <div
                key={spot.id}
                style={{
                  left: `${coords.x}px`,
                  top: `${coords.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute pointer-events-auto transition-transform duration-75 hover:scale-110 z-20 group"
                onClick={() => focusSubsystem(spot.subsystem)}
                onMouseEnter={() => setHoveredHotspot(spot)}
                onMouseLeave={() => setHoveredHotspot(null)}
              >
                {/* Pulsing Marker Ring */}
                <div className="relative flex items-center justify-center">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-lg ${
                    isAffected 
                      ? telemetry.anomalySeverity === 'CRITICAL' 
                        ? 'border-red-500 bg-red-950/80 animate-ping' 
                        : 'border-amber-500 bg-amber-950/80 animate-pulse'
                      : isSelected 
                        ? 'border-cyan-400 bg-cyan-950/80' 
                        : 'border-slate-400 bg-slate-900/80 group-hover:border-cyan-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      isAffected ? (telemetry.anomalySeverity === 'CRITICAL' ? 'bg-red-400' : 'bg-amber-400') : (isSelected ? 'bg-cyan-400' : 'bg-slate-300')
                    }`} />
                  </div>

                  {/* Pin Pill Label */}
                  <div className={`ml-2 px-2.5 py-1 rounded-md text-[11px] font-mono tracking-tight whitespace-nowrap backdrop-blur-md border shadow-xl flex items-center gap-1.5 ${
                    isAffected 
                      ? telemetry.anomalySeverity === 'CRITICAL'
                        ? 'bg-red-950/90 text-red-200 border-red-500/80 shadow-red-900/40' 
                        : 'bg-amber-950/90 text-amber-200 border-amber-500/80 shadow-amber-900/40'
                      : isSelected
                        ? 'bg-cyan-950/90 text-cyan-200 border-cyan-500/80 shadow-cyan-900/40'
                        : 'bg-slate-900/85 text-slate-200 border-slate-700 hover:border-slate-500'
                  }`}>
                    <span className="font-semibold text-slate-300">{spot.label}:</span>
                    <span className="font-mono font-bold text-white">{formattedVal}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TOP FLOATING AEROSPACE HUD BAR */}
      <div className="absolute top-4 left-4 right-4 flex flex-col lg:flex-row items-stretch lg:items-start justify-between gap-3 pointer-events-none z-30">
        {/* Left Column: View Mode Controls & Subsystem Direct Selector */}
        <div className="flex flex-col gap-2 pointer-events-auto max-w-2xl">
          {/* Row 1: View Modes */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/90 shadow-2xl overflow-x-auto">
            <button
              id="btn-view-solid"
              onClick={() => onViewModeChange('solid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${
                viewMode === 'solid' 
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20' 
                  : 'text-slate-300 hover:bg-slate-800/80'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Solid Metallic</span>
            </button>

            <button
              id="btn-view-cutaway"
              onClick={() => onViewModeChange('cutaway')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${
                viewMode === 'cutaway' 
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20' 
                  : 'text-slate-300 hover:bg-slate-800/80'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>X-Ray Cutaway</span>
            </button>

            <button
              id="btn-view-thermal"
              onClick={() => onViewModeChange('thermal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${
                viewMode === 'thermal' 
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20' 
                  : 'text-slate-300 hover:bg-slate-800/80'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-950" />
              <span>Brayton Thermal</span>
            </button>

            <button
              id="btn-view-wireframe"
              onClick={() => onViewModeChange('wireframe')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${
                viewMode === 'wireframe' 
                  ? 'bg-cyan-400 text-slate-950 font-bold shadow-md' 
                  : 'text-slate-300 hover:bg-slate-800/80'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Holo Wireframe</span>
            </button>
          </div>

          {/* Row 2: Subsystem Quick Jump Chips */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/80 backdrop-blur-xl rounded-xl border border-slate-800/80 shadow-2xl overflow-x-auto">
            <button
              onClick={() => focusSubsystem(null)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition-all ${
                selectedSubsystem === null
                  ? 'bg-slate-700 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              All Engine
            </button>

            {(['fan', 'lpc', 'hpc', 'combustor', 'hpt', 'lpt', 'nozzle', 'bearings'] as SubsystemId[]).map((subId) => {
              const isAffected = telemetry.affectedSubsystems.includes(subId);
              const isSelected = selectedSubsystem === subId;
              const subMeta = SUBSYSTEMS[subId];

              return (
                <button
                  key={subId}
                  onClick={() => focusSubsystem(subId)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-500 font-bold shadow-md shadow-cyan-900/30'
                      : isAffected
                        ? telemetry.anomalySeverity === 'CRITICAL'
                          ? 'bg-red-950/80 text-red-300 border border-red-500/80 animate-pulse font-bold'
                          : 'bg-amber-950/80 text-amber-300 border border-amber-500/80 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                  }`}
                  title={subMeta?.fullName || subId}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isAffected 
                      ? telemetry.anomalySeverity === 'CRITICAL' ? 'bg-red-400 animate-ping' : 'bg-amber-400' 
                      : isSelected ? 'bg-cyan-400' : 'bg-slate-500'
                  }`} />
                  <span className="uppercase">{subId}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Telemetry Tele-HUD & Viewport Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pointer-events-auto">
          {/* Live Flight Tele-HUD Metric Strip */}
          <div className="px-3.5 py-2 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800 shadow-2xl flex items-center gap-3.5 text-xs font-mono">
            {/* Health Index Ring */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border ${
                isCritical 
                  ? 'bg-red-950/90 border-red-500 text-red-300 animate-pulse' 
                  : isWarning 
                    ? 'bg-amber-950/90 border-amber-500 text-amber-300' 
                    : 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
              }`}>
                {telemetry.healthIndex.toFixed(0)}%
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block leading-tight">HEALTH</span>
                <span className={`text-[11px] font-bold ${
                  isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'NOMINAL'}
                </span>
              </div>
            </div>

            <div className="w-px h-6 bg-slate-800 hidden sm:block" />

            {/* N1 Fan RPM */}
            <div className="hidden sm:block">
              <span className="text-[10px] text-slate-500 block leading-tight">N1 (FAN)</span>
              <span className="font-bold text-cyan-300">{telemetry.Nf.toFixed(0)} <span className="text-[9px] text-slate-400">RPM</span></span>
            </div>

            <div className="w-px h-6 bg-slate-800 hidden md:block" />

            {/* N2 Core RPM */}
            <div className="hidden md:block">
              <span className="text-[10px] text-slate-500 block leading-tight">N2 (CORE)</span>
              <span className="font-bold text-cyan-300">{telemetry.Nc.toFixed(0)} <span className="text-[9px] text-slate-400">RPM</span></span>
            </div>

            <div className="w-px h-6 bg-slate-800 hidden md:block" />

            {/* EGT Celsius */}
            <div className="hidden md:block">
              <span className="text-[10px] text-slate-500 block leading-tight">EGT</span>
              <span className={`font-bold ${
                telemetry.egtCelsius > 750 ? 'text-red-400' : telemetry.egtCelsius > 680 ? 'text-amber-400' : 'text-slate-200'
              }`}>
                {telemetry.egtCelsius.toFixed(0)}°C
              </span>
            </div>
          </div>

          {/* Quick Action Toggle Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800 shadow-2xl">
            <button
              id="btn-toggle-particles"
              onClick={() => setShowAirflow(!showAirflow)}
              className={`p-2 rounded-lg text-xs font-medium border transition-all ${
                showAirflow 
                  ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-900/30' 
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-white'
              }`}
              title="Toggle Aerodynamic Particle Streamlines"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            <button
              id="btn-toggle-pins"
              onClick={() => setShowHotspots(!showHotspots)}
              className={`p-2 rounded-lg text-xs font-medium border transition-all ${
                showHotspots 
                  ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-900/30' 
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-white'
              }`}
              title="Toggle Sensor 3D Hotspot Pins"
            >
              <Gauge className="w-4 h-4" />
            </button>

            <button
              id="btn-toggle-rotate"
              onClick={() => setAutoRotate(!autoRotate)}
              className={`p-2 rounded-lg text-xs font-medium border transition-all ${
                autoRotate 
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-900/30' 
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-white'
              }`}
              title="Toggle Auto Orbit Rotation"
            >
              <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
            </button>

            <button
              id="btn-reset-cam"
              onClick={() => setCameraView('iso')}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/60 transition-all"
              title="Reset Camera to Isometric View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* FULLSCREEN EXPAND / COLLAPSE BUTTON */}
            <button
              id="btn-toggle-fullscreen"
              onClick={toggleFullscreen}
              className={`p-2 rounded-lg text-xs font-medium border transition-all ${
                isFullscreen 
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-md shadow-emerald-900/40' 
                  : 'bg-slate-800/90 hover:bg-slate-700 text-emerald-400 border-slate-700 hover:border-emerald-500/50'
              }`}
              title={isFullscreen ? 'Exit Full Screen Mode (ESC)' : 'Expand 3D Engine to Full Screen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM FLOATING CONTROL DECK: Exploded Slider & Camera Views */}
      <div className="absolute bottom-5 left-4 right-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pointer-events-none z-30">
        {/* Exploded View Controls with Instant Presets */}
        <div className="p-2.5 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/90 shadow-2xl pointer-events-auto flex items-center gap-3 w-full md:w-96">
          <span className="text-xs font-semibold text-slate-300 whitespace-nowrap flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Exploded View:
          </span>

          <input
            id="input-exploded-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={explodedProgress}
            onChange={(e) => onExplodedProgressChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          <span className="text-xs font-mono text-cyan-300 font-bold w-9 text-right">
            {(explodedProgress * 100).toFixed(0)}%
          </span>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
            <button
              onClick={() => onExplodedProgressChange(0)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                explodedProgress === 0 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white bg-slate-800'
              }`}
              title="Compact / Assembled Engine (0%)"
            >
              0%
            </button>
            <button
              onClick={() => onExplodedProgressChange(0.35)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                Math.abs(explodedProgress - 0.35) < 0.05 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white bg-slate-800'
              }`}
              title="Inspection Offset (35%)"
            >
              35%
            </button>
            <button
              onClick={() => onExplodedProgressChange(0.85)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                explodedProgress > 0.75 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white bg-slate-800'
              }`}
              title="Full Exploded Separation (85%)"
            >
              85%
            </button>
          </div>
        </div>

        {/* Camera Angles Strip */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-800/90 shadow-2xl pointer-events-auto overflow-x-auto">
          {(['iso', 'intake', 'side', 'combustor', 'turbine', 'exhaust', 'top'] as CameraPreset[]).map((preset) => (
            <button
              key={preset}
              id={`btn-cam-${preset}`}
              onClick={() => setCameraView(preset)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-all ${
                cameraPreset === preset 
                  ? 'bg-slate-700 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {preset === 'iso' ? 'Isometric' : preset}
            </button>
          ))}
        </div>
      </div>

      {/* SELECTED SUBSYSTEM HIGHLIGHT CARD (Floating Left Overlay) */}
      {selectedSubsystem && SUBSYSTEMS[selectedSubsystem] && (
        <div className="absolute top-28 left-4 max-w-sm p-4 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/80 shadow-2xl z-30 pointer-events-auto animate-fade-in text-left">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 font-bold">
                {SUBSYSTEMS[selectedSubsystem].ataCode}
              </span>
              <h3 className="text-sm font-bold text-white">
                {SUBSYSTEMS[selectedSubsystem].fullName}
              </h3>
            </div>
            
            <div className="flex items-center gap-1.5">
              {telemetry.affectedSubsystems.includes(selectedSubsystem) && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                  ANOMALY
                </span>
              )}
              <button
                onClick={() => focusSubsystem(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Deselect subsystem"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-3">
            {SUBSYSTEMS[selectedSubsystem].description}
          </p>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 mb-3">
            <div>
              <span className="text-slate-500 block">Nominal Temp:</span>
              <span className="text-slate-200">{SUBSYSTEMS[selectedSubsystem].nominalTempRange}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Nominal Press:</span>
              <span className="text-slate-200">{SUBSYSTEMS[selectedSubsystem].nominalPressureRange}</span>
            </div>
          </div>

          {onOpenAIDiagnostic && (
            <button
              onClick={() => onOpenAIDiagnostic()}
              className="w-full py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-200" />
              <span>Diagnose {SUBSYSTEMS[selectedSubsystem].name}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Procedural 3D Turbofan Geometry Builder
function buildEngineGeometry(scene: THREE.Scene) {
  const groups: Record<SubsystemId, THREE.Group> = {} as any;
  const materials: Record<string, THREE.MeshStandardMaterial> = {};

  // Root Assembly
  const engineRoot = new THREE.Group();
  scene.add(engineRoot);

  // Subsystem Groups
  const fanGroup = new THREE.Group();
  const lpcGroup = new THREE.Group();
  const hpcGroup = new THREE.Group();
  const combustorGroup = new THREE.Group();
  const hptGroup = new THREE.Group();
  const lptGroup = new THREE.Group();
  const nozzleGroup = new THREE.Group();
  const nacelleGroup = new THREE.Group();
  const bearingsGroup = new THREE.Group();
  const gearboxGroup = new THREE.Group();

  engineRoot.add(fanGroup);
  engineRoot.add(lpcGroup);
  engineRoot.add(hpcGroup);
  engineRoot.add(combustorGroup);
  engineRoot.add(hptGroup);
  engineRoot.add(lptGroup);
  engineRoot.add(nozzleGroup);
  engineRoot.add(nacelleGroup);
  engineRoot.add(bearingsGroup);
  engineRoot.add(gearboxGroup);

  groups.fan = fanGroup;
  groups.lpc = lpcGroup;
  groups.hpc = hpcGroup;
  groups.combustor = combustorGroup;
  groups.hpt = hptGroup;
  groups.lpt = lptGroup;
  groups.nozzle = nozzleGroup;
  groups.nacelle = nacelleGroup;
  groups.bearings = bearingsGroup;
  groups.gearbox = gearboxGroup;

  // Rotators
  const fanRotor = new THREE.Group();
  fanGroup.add(fanRotor);

  const n1Rotor = new THREE.Group();
  engineRoot.add(n1Rotor);

  const n2Rotor = new THREE.Group();
  engineRoot.add(n2Rotor);

  // Define Materials
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0xb8c4d4,
    metalness: 0.88,
    roughness: 0.22,
    envMapIntensity: 1.5,
  });
  materials.fan = titaniumMat;

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.85,
    roughness: 0.3,
  });
  materials.lpc = steelMat;

  const nickelMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.9,
    roughness: 0.25,
  });
  materials.hpc = nickelMat;

  const combustorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.75,
    roughness: 0.45,
    emissive: 0xff3300,
    emissiveIntensity: 0.15,
  });
  materials.combustor = combustorMat;

  const hptMat = new THREE.MeshStandardMaterial({
    color: 0xc27803,
    metalness: 0.92,
    roughness: 0.2,
    emissive: 0xff5500,
    emissiveIntensity: 0.25,
  });
  materials.hpt = hptMat;

  const lptMat = new THREE.MeshStandardMaterial({
    color: 0x85929e,
    metalness: 0.85,
    roughness: 0.28,
  });
  materials.lpt = lptMat;

  const nozzleMat = new THREE.MeshStandardMaterial({
    color: 0x273746,
    metalness: 0.8,
    roughness: 0.35,
  });
  materials.nozzle = nozzleMat;

  const nacelleMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.7,
    roughness: 0.3,
    transparent: true,
    opacity: 0.35,
  });
  materials.nacelle = nacelleMat;

  const bearingMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.95,
    roughness: 0.15,
  });
  materials.bearings = bearingMat;

  const gearboxMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.8,
    roughness: 0.35,
  });
  materials.gearbox = gearboxMat;

  // 1. FAN STAGE (Intake Spinner & 24 Wide-Chord Blades)
  // Spinner Cone
  const spinnerGeo = new THREE.ConeGeometry(0.75, 1.8, 32);
  spinnerGeo.rotateZ(Math.PI / 2);
  const spinnerMesh = new THREE.Mesh(spinnerGeo, titaniumMat);
  spinnerMesh.position.x = -5.4;
  fanRotor.add(spinnerMesh);

  // Fan Hub
  const fanHubGeo = new THREE.CylinderGeometry(0.8, 0.85, 0.8, 32);
  fanHubGeo.rotateZ(Math.PI / 2);
  const fanHubMesh = new THREE.Mesh(fanHubGeo, titaniumMat);
  fanHubMesh.position.x = -4.5;
  fanRotor.add(fanHubMesh);

  // 24 Titanium Fan Blades with Aerodynamic Twist
  const bladeCount = 24;
  const bladeRadius = 2.4;
  const bladeShape = new THREE.BoxGeometry(0.25, bladeRadius, 0.08);

  for (let i = 0; i < bladeCount; i++) {
    const angle = (i / bladeCount) * Math.PI * 2;
    const bladeMesh = new THREE.Mesh(bladeShape, titaniumMat);
    bladeMesh.position.x = -4.5;
    bladeMesh.position.y = Math.cos(angle) * (bladeRadius * 0.5 + 0.35);
    bladeMesh.position.z = Math.sin(angle) * (bladeRadius * 0.5 + 0.35);
    bladeMesh.rotation.x = angle + 0.35; // Aerodynamic pitch angle
    bladeMesh.rotation.y = 0.2;
    fanRotor.add(bladeMesh);
  }

  // Fan Stator Outlet Guide Vanes (Stationary)
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2;
    const statorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.3, 0.05), steelMat);
    statorMesh.position.x = -3.8;
    statorMesh.position.y = Math.cos(angle) * (bladeRadius * 0.5 + 0.35);
    statorMesh.position.z = Math.sin(angle) * (bladeRadius * 0.5 + 0.35);
    statorMesh.rotation.x = angle - 0.2;
    fanGroup.add(statorMesh);
  }

  // 2. LOW PRESSURE COMPRESSOR (LPC Booster: 3 stages)
  const lpcHubGeo = new THREE.CylinderGeometry(0.9, 1.05, 1.4, 32);
  lpcHubGeo.rotateZ(Math.PI / 2);
  const lpcHub = new THREE.Mesh(lpcHubGeo, steelMat);
  lpcHub.position.x = -2.8;
  n1Rotor.add(lpcHub);

  for (let stage = 0; stage < 3; stage++) {
    const stageX = -3.2 + stage * 0.45;
    const stageBlades = 20;
    const radius = 1.45 - stage * 0.08;
    for (let i = 0; i < stageBlades; i++) {
      const angle = (i / stageBlades) * Math.PI * 2;
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, radius * 0.6, 0.05), steelMat);
      bMesh.position.x = stageX;
      bMesh.position.y = Math.cos(angle) * (radius * 0.65);
      bMesh.position.z = Math.sin(angle) * (radius * 0.65);
      bMesh.rotation.x = angle + 0.3;
      n1Rotor.add(bMesh);
    }
  }

  // 3. HIGH PRESSURE COMPRESSOR (HPC: 9 Stages)
  const hpcHubGeo = new THREE.CylinderGeometry(1.05, 1.25, 2.2, 32);
  hpcHubGeo.rotateZ(Math.PI / 2);
  const hpcHub = new THREE.Mesh(hpcHubGeo, nickelMat);
  hpcHub.position.x = -0.9;
  n2Rotor.add(hpcHub);

  for (let stage = 0; stage < 9; stage++) {
    const stageX = -1.8 + stage * 0.22;
    const stageBlades = 24 + stage;
    const radius = 1.35 - stage * 0.035;
    for (let i = 0; i < stageBlades; i++) {
      const angle = (i / stageBlades) * Math.PI * 2;
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, radius * 0.45, 0.04), nickelMat);
      bMesh.position.x = stageX;
      bMesh.position.y = Math.cos(angle) * (radius * 0.68);
      bMesh.position.z = Math.sin(angle) * (radius * 0.68);
      bMesh.rotation.x = angle + 0.35;
      n2Rotor.add(bMesh);
    }
  }

  // 4. COMBUSTION CHAMBER (Annular Burner with Injector Nozzles)
  const combustorOuterGeo = new THREE.CylinderGeometry(1.3, 1.25, 1.6, 32, 1, true);
  combustorOuterGeo.rotateZ(Math.PI / 2);
  const combustorOuter = new THREE.Mesh(combustorOuterGeo, combustorMat);
  combustorOuter.position.x = 1.1;
  combustorGroup.add(combustorOuter);

  const combustorInnerGeo = new THREE.CylinderGeometry(0.85, 0.8, 1.6, 32, 1, true);
  combustorInnerGeo.rotateZ(Math.PI / 2);
  const combustorInner = new THREE.Mesh(combustorInnerGeo, combustorMat);
  combustorInner.position.x = 1.1;
  combustorGroup.add(combustorInner);

  // 18 Fuel Nozzles around ring
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const nozzleHead = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 12), bearingMat);
    nozzleHead.position.x = 0.5;
    nozzleHead.position.y = Math.cos(angle) * 1.05;
    nozzleHead.position.z = Math.sin(angle) * 1.05;
    combustorGroup.add(nozzleHead);
  }

  // 5. HIGH PRESSURE TURBINE (HPT: 2 Stages)
  const hptHubGeo = new THREE.CylinderGeometry(1.18, 1.12, 0.8, 32);
  hptHubGeo.rotateZ(Math.PI / 2);
  const hptHub = new THREE.Mesh(hptHubGeo, hptMat);
  hptHub.position.x = 2.6;
  n2Rotor.add(hptHub);

  for (let stage = 0; stage < 2; stage++) {
    const stageX = 2.4 + stage * 0.35;
    const stageBlades = 32;
    const radius = 1.28 + stage * 0.05;
    for (let i = 0; i < stageBlades; i++) {
      const angle = (i / stageBlades) * Math.PI * 2;
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, radius * 0.5, 0.04), hptMat);
      bMesh.position.x = stageX;
      bMesh.position.y = Math.cos(angle) * (radius * 0.62);
      bMesh.position.z = Math.sin(angle) * (radius * 0.62);
      bMesh.rotation.x = angle - 0.4;
      n2Rotor.add(bMesh);
    }
  }

  // 6. LOW PRESSURE TURBINE (LPT: 5 Stages)
  const lptHubGeo = new THREE.CylinderGeometry(1.1, 0.95, 1.8, 32);
  lptHubGeo.rotateZ(Math.PI / 2);
  const lptHub = new THREE.Mesh(lptHubGeo, lptMat);
  lptHub.position.x = 4.1;
  n1Rotor.add(lptHub);

  for (let stage = 0; stage < 5; stage++) {
    const stageX = 3.4 + stage * 0.32;
    const stageBlades = 28;
    const radius = 1.35 + stage * 0.06;
    for (let i = 0; i < stageBlades; i++) {
      const angle = (i / stageBlades) * Math.PI * 2;
      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, radius * 0.55, 0.04), lptMat);
      bMesh.position.x = stageX;
      bMesh.position.y = Math.cos(angle) * (radius * 0.6);
      bMesh.position.z = Math.sin(angle) * (radius * 0.6);
      bMesh.rotation.x = angle - 0.35;
      n1Rotor.add(bMesh);
    }
  }

  // 7. EXHAUST NOZZLE & CENTER PLUG
  const exhaustPlugGeo = new THREE.ConeGeometry(0.85, 2.4, 32);
  exhaustPlugGeo.rotateZ(-Math.PI / 2);
  const exhaustPlug = new THREE.Mesh(exhaustPlugGeo, nozzleMat);
  exhaustPlug.position.x = 6.2;
  nozzleGroup.add(exhaustPlug);

  const exhaustCasingGeo = new THREE.CylinderGeometry(1.2, 1.45, 2.0, 32, 1, true);
  exhaustCasingGeo.rotateZ(Math.PI / 2);
  const exhaustCasing = new THREE.Mesh(exhaustCasingGeo, nozzleMat);
  exhaustCasing.position.x = 5.6;
  nozzleGroup.add(exhaustCasing);

  // 8. CO-AXIAL DRIVE SHAFTS & BEARINGS
  const n1ShaftGeo = new THREE.CylinderGeometry(0.22, 0.22, 10.5, 24);
  n1ShaftGeo.rotateZ(Math.PI / 2);
  const n1Shaft = new THREE.Mesh(n1ShaftGeo, steelMat);
  n1Shaft.position.x = 0;
  n1Rotor.add(n1Shaft);

  // Bearings #1, #2, #4
  const b1Geo = new THREE.TorusGeometry(0.5, 0.12, 16, 32);
  b1Geo.rotateY(Math.PI / 2);
  const b1Mesh = new THREE.Mesh(b1Geo, bearingMat);
  b1Mesh.position.x = -4.0;
  bearingsGroup.add(b1Mesh);

  const b4Geo = new THREE.TorusGeometry(0.7, 0.14, 16, 32);
  b4Geo.rotateY(Math.PI / 2);
  const b4Mesh = new THREE.Mesh(b4Geo, bearingMat);
  b4Mesh.position.x = 2.2;
  bearingsGroup.add(b4Mesh);

  // 9. NACELLE & BYPASS COWL (Outer Shell)
  const nacelleGeo = new THREE.CylinderGeometry(2.6, 2.45, 9.5, 48, 1, true);
  nacelleGeo.rotateZ(Math.PI / 2);
  const nacelleMesh = new THREE.Mesh(nacelleGeo, nacelleMat);
  nacelleMesh.position.x = -0.5;
  nacelleGroup.add(nacelleMesh);

  // Lip Ring at Intake
  const lipGeo = new THREE.TorusGeometry(2.6, 0.12, 16, 48);
  lipGeo.rotateY(Math.PI / 2);
  const lipMesh = new THREE.Mesh(lipGeo, titaniumMat);
  lipMesh.position.x = -5.2;
  nacelleGroup.add(lipMesh);

  return {
    groups,
    rotators: { n1Rotor, n2Rotor, fanRotor },
    materials
  };
}

// Particle Airflow Simulator Geometry
function buildAirflowParticles(scene: THREE.Scene): THREE.Points {
  const particleCount = 2800;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const idx = i * 3;
    const x = -6.5 + Math.random() * 15.0; // Span lengthwise
    const isBypass = Math.random() > 0.35;

    let radius: number;
    if (isBypass) {
      // Flow along bypass duct
      radius = 1.6 + Math.random() * 0.9;
    } else {
      // Flow through core
      if (x < -2) radius = 0.4 + Math.random() * 0.8;
      else if (x < 1.5) radius = 0.2 + Math.random() * 0.6;
      else if (x < 4.5) radius = 0.3 + Math.random() * 0.7;
      else radius = 0.2 + Math.random() * 0.9;
    }

    const angle = Math.random() * Math.PI * 2;
    positions[idx] = x;
    positions[idx + 1] = Math.cos(angle) * radius;
    positions[idx + 2] = Math.sin(angle) * radius;

    // Color gradient based on temperature progression
    if (isBypass || x < -2.0) {
      // Cool blue intake / bypass
      colors[idx] = 0.1;
      colors[idx + 1] = 0.6;
      colors[idx + 2] = 1.0;
    } else if (x < 0.8) {
      // Compressed warm yellow
      colors[idx] = 0.2;
      colors[idx + 1] = 0.9;
      colors[idx + 2] = 0.6;
    } else if (x < 2.8) {
      // Combustion fire orange
      colors[idx] = 1.0;
      colors[idx + 1] = 0.4;
      colors[idx + 2] = 0.1;
    } else {
      // Exhaust flame
      colors[idx] = 1.0;
      colors[idx + 1] = 0.2;
      colors[idx + 2] = 0.05;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.07,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}
