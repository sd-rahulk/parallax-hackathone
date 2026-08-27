# 🛰️ AeroGuard Frontend - 3D Digital Twin & Aerospace Telemetry Cockpit

A high-performance **Next.js 16 / React 19** interactive digital twin and predictive diagnostics cockpit for aircraft turbofan engines. Built with **Three.js**, **WebGL**, **Tailwind CSS v4**, and **Recharts**.

---

## ✨ Features & Capabilities

### 1. 🛩️ Interactive 3D Turbofan Digital Twin (`ThreeEngineViewer.tsx`)
- **WebGL Hardware Acceleration**: Renders complex CAD turbofan geometries with sub-millisecond response times.
- **Multiple Inspection View Modes**:
  - `Cutaway View`: Longitudinal cross-section revealing core gas generator, spools, and stator stages.
  - `Exploded View`: Dynamic slider-controlled component separation for internal mechanical inspection.
  - `Full Hull View`: Aerodynamic nacelle and cowl exterior view.
  - `X-Ray Wireframe View`: Transparent structural shell with highlighted internal stress nodes.
- **Real-Time Dynamic Heatmap Shaders**: Maps instantaneous thermodynamic readings ($T_{24}, T_{30}, T_{50}, P_{30}$) directly onto 3D mesh vertices.
- **Interactive 3D Subsystem Hotspots**: Clickable 3D callouts for Fan, LPC, HPC, Combustor, HPT, LPT, Bearings, and Gearbox.
- **Dynamic Particle Flow Simulation**: Visualizes core mass flow, bypass stream, and supersonic exhaust plume.

### 2. 📈 Live Telemetry Stream & Analytical Dashboard (`TelemetryDashboard.tsx`)
- **21+ Monitored Engine Parameters**: Fan & Core Speeds ($N_f, N_c, NR_f, NR_c$), Temperatures ($T_2, T_{24}, T_{30}, T_{50}$), Pressures ($P_2, P_{15}, P_{30}, P_{s30}$), Flows ($BPR, W_{31}, W_{32}, htBleed$), Oil Health, and Broadband Vibration.
- **Multi-Track Live Charts**: Recharts-powered real-time sliding window graphs.
- **Health Index & RUL Meter**: Real-time gauge of State of Health ($0-100\%$) and Remaining Useful Life (Flight Cycles).
- **Subsystem Status Matrix**: Instant green/amber/red operational health indicators across all 8 engine compartments.

### 3. 🧪 Dual Telemetry Ingestion Modes
- **NASA C-MAPSS Flight Replay Mode**: Step-by-step playback of actual run-to-failure engine trajectories from datasets `FD003` and `FD004`.
- **Dynamic Brownian Simulation Mode**: Real-time flight engine simulator featuring realistic thermodynamic perturbations and selectable flight scenarios:
  - *Nominal Cruise*
  - *High-Pressure Compressor Tip Erosion*
  - *High-Pressure Turbine Hot Streaks*
  - *No. 1 Bearing Spallation & High Vibration*
  - *Severe Multi-Subsystem Cascade Fault*

### 4. 🧠 Gemini AI Aerospace Propulsion Diagnostics (`DiagnosticAIModal.tsx`)
- Generates comprehensive engineering diagnostic reports:
  - **ATA 100 Chapter Assignment** (e.g., *ATA 72-30 HPC*, *ATA 72-50 Turbine Section*).
  - **Root-Cause Analysis** with specific mechanical/aerodynamic failure mechanisms.
  - **Flight Deck Action Items** for immediate pilot advisories.
  - **Ground Maintenance Procedures** with step-by-step work card instructions.
  - **Recommended Line Replaceable Units (LRUs)** & OEM part numbers.

### 5. 💰 Operational Impact & Cost Calculator (`OperationalImpactSection.tsx`)
- Real-time financial modeling estimating:
  - **Fuel Burn Inefficiency Cost ($/hr)** caused by degraded compressor/turbine stages.
  - **Unscheduled Maintenance Penalty Risk ($)** vs. planned line maintenance.
  - **Flight Cancellation & Delay Risk Matrix**.

### 6. 🔊 Cockpit Master Warning & Audio Annunciator (`audioAlerts.ts`)
- Zero-latency **Web Audio API** synthesis with pre-decoded hardware audio buffers.
- Realistic cockpit Master Caution (Single Chime) and Master Warning (Continuous Alarm).
- Instant global audio mute and emergency auto-pause on fault detection.

### 7. 🎛️ Manual Telemetry & Anomaly Injector (`ManualAnomalyTester.tsx`)
- Interactive parameter sliders allowing engineers to inject edge-case values and test ML sensitivity live.

### 8. 📄 Engineering Report Export (`ReportExportModal.tsx`)
- Generates formatted, printable, and downloadable PDF-ready flight readiness certificates and technical work cards.

---

## 🏗️ Project Architecture

```
frontend/
├── app/
│   ├── api/
│   │   ├── anomaly/route.ts      # LSTM Autoencoder ML inference API
│   │   ├── dataset/route.ts      # NASA C-MAPSS dataset stream provider
│   │   ├── gemini/diagnose/      # Gemini AI aerospace diagnostic engine
│   │   ├── health/route.ts       # System & edge health status
│   │   └── recommender/route.ts  # 50-Fault deterministic recommender API
│   ├── favicon.ico
│   ├── globals.css               # Tailwind CSS v4 styling & dark theme
│   ├── layout.tsx                # Root HTML layout with viewport settings
│   └── page.tsx                  # Master Cockpit orchestration dashboard
├── assets/                       # NASA C-MAPSS RAW CSV datasets
├── components/
│   ├── DiagnosticAIModal.tsx     # Gemini AI deep diagnostics modal
│   ├── ManualAnomalyTester.tsx   # Interactive telemetry injection workbench
│   ├── NotificationCenter.tsx    # Live fault event stream & toast toasts
│   ├── OperationalImpactSection.tsx # Financial ROI & fuel penalty estimator
│   ├── ReportExportModal.tsx     # PDF / Work Card report export dialog
│   ├── ScenarioSelector.tsx      # Flight scenario & dataset trajectory selector
│   ├── TelemetryDashboard.tsx    # Real-time multi-sensor telemetry visualizer
│   └── ThreeEngineViewer.tsx     # Three.js 3D WebGL turbofan digital twin
├── public/                       # 3D GLB/FBX models & alarm audio assets
├── types/
│   └── engine.ts                 # Strong TypeScript definitions for aerospace telemetry
└── utils/
    ├── audioAlerts.ts            # Web Audio API cockpit annunciator
    ├── engineRecommender.ts      # 50-Fault deterministic rule catalog
    ├── mlAutoencoder.ts          # Autoencoder residual evaluation logic
    ├── operationalImpact.ts      # Fuel burn & cost estimation calculations
    └── telemetryEngine.ts        # Physics-based telemetry & Brownian generator
```

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **UI Core**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **3D Graphics**: [Three.js](https://threejs.org/) + WebGL
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI Integration**: Google Gemini API via `@google/genai`
- **Effects**: `canvas-confetti`

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18.18.0 or higher (Node.js 20+ recommended)
- `npm` or `pnpm` or `yarn`

### 2. Installation
Navigate to the `frontend` directory and install the dependencies:
```bash
cd frontend
npm install
```

### 3. Environment Variables (Optional)
Create a `.env.local` file in the `frontend` root to enable Gemini AI diagnostics:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```
*(Note: If no API key is provided, the system seamlessly uses the aerospace expert propulsion rule engine fallback).*

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser to access the cockpit.

### 5. Production Build
```bash
npm run build
npm run start
```

---

## 🛰️ Edge API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/anomaly` | `POST` | Ingests telemetry array and outputs autoencoder reconstruction MAE, anomaly severity, and affected subsystems. |
| `/api/anomaly` | `GET` | Returns autoencoder configuration, feature count, and calibration thresholds. |
| `/api/recommender` | `POST` | Ingests sensor map and outputs matched fault codes from the 50-rule catalog with 2-line ATA directives. |
| `/api/recommender?catalog=true` | `GET` | Returns the entire 50-fault aerospace diagnostic catalog. |
| `/api/gemini/diagnose` | `POST` | Generates deep AI root cause analysis, ATA chapters, and ground maintenance procedures. |
| `/api/dataset?file=FD003&unit=82` | `GET` | Streams flight cycles from NASA C-MAPSS dataset files. |
| `/api/health` | `GET` | Service liveness and telemetry synchronization check. |

---

## 📄 License
Developed for the **Parallax Aerospace Hackathon**.
