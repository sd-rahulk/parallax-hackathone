# Aircraft Engine Health Monitoring & Wide Range Predictive Recommender (PS-S02)

Offline Machine Learning Recommender Model based on NASA C-MAPSS dataset and published research (**Yildirim & Rana 2024**, **Mehmet Deniz 2025**).

Provides a **Wide Range of Recommendations** across **8 Engine Subsystems** (High-Pressure Compressor, Low-Pressure Compressor, Combustor Fuel System, High-Pressure Turbine Cooling, Low-Pressure Turbine Seals, Dual-Spool Rotors, Bypass Ducting, Customer Bleed Air System).

---

## Quick Start for VSCode

### 1. Run Wide Range Test Suite
To test multi-fault diagnostic recommendations in the VSCode terminal:
```bash
python test_model.py
```

---

## How to Get a Wide Range of Recommendations in Code

Your friend can import `predict_engine_health()` to get both the primary 2-line output AND the complete list of multi-fault recommendations:

```python
from engine_recommender import predict_engine_health

# Sensor telemetry dictionary from your UI
telemetry_data = {
    's3': 1636.5,   # HPC Outlet Temp (°R)
    's7': 537.2,    # HPC Outlet Pressure (psia)
    's12': 538.5,   # Fuel-to-pressure ratio (pps/psia)
    's21': 21.10    # LPT Coolant Bleed Flow (lb/s)
}

# Run prediction
result = predict_engine_health(telemetry_data)

print(f"Status: {result['status']}")
print(f"Total Recommendations: {result['total_faults_detected']}")

# Access the WIDE RANGE of recommendations:
for i, rec in enumerate(result['recommendations_list'], 1):
    print(f"\n--- Recommendation #{i} [{rec['severity']}] Subsystem: {rec['subsystem']} ---")
    print(rec['problem'])  # Line 1: Problem Diagnosis
    print(rec['fix'])      # Line 2: Actionable Fix
```

---

## Return Data Structure

```json
{
  "status": "NEEDS MAINTENANCE",
  "health_index": 0.0,
  "rul_cycles": 0,
  "total_faults_detected": 5,
  "line1_problem": "[PROBLEM] HPC Outlet Temp T30 elevated (1636.5 R, +7.4 std_dev) with pressure drop P30 (537.2 psia)...",
  "line2_fix": "[FIX] Perform stage 4-7 borescope inspection, replace eroded HPC stator vanes...",
  "recommendations_list": [
    {
      "subsystem": "High-Pressure Compressor (HPC)",
      "severity": "CRITICAL",
      "problem": "[PROBLEM] HPC Outlet Temp T30 elevated...",
      "fix": "[FIX] Perform stage 4-7 borescope inspection..."
    },
    {
      "subsystem": "Combustor & Fuel Injection System",
      "severity": "CRITICAL",
      "problem": "[PROBLEM] Fuel-to-pressure ratio phi anomalous...",
      "fix": "[FIX] Remove and flow-test fuel manifold nozzles..."
    },
    {
      "subsystem": "Low-Pressure Turbine (LPT)",
      "severity": "CRITICAL",
      "problem": "[PROBLEM] LPT Outlet Temp T50 excessive...",
      "fix": "[FIX] Inspect LPT shroud seals, replace thermal barrier coated turbine blades..."
    }
  ]
}
```
