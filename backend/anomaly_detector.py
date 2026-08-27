"""
===============================================================================
AEROGUARD ML ANOMALY DETECTION ENGINE
Powered by user's trained 'full_autoencoder.keras' LSTM Autoencoder
===============================================================================
Architecture:
- Sequential LSTM Autoencoder: (None, 50, 19) -> (None, 50, 19)
- Metric: Reconstruction MAE & Differential Residual Attributions
- Anomaly Classification: Nominal (0-40%), Warning (40-75%), Critical (75-100%)
===============================================================================
"""

import os
import sys
import json
import numpy as np

# Suppress TensorFlow logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

# Model discovery
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MODEL_PATHS = [
    os.path.join(ROOT_DIR, 'full_autoencoder.keras'),
    os.path.join(os.path.dirname(__file__), 'full_autoencoder.keras'),
    os.path.join(os.getcwd(), 'full_autoencoder.keras'),
    'full_autoencoder.keras'
]

MODEL_PATH = next((p for p in MODEL_PATHS if os.path.exists(p)), None)

# 19 Autoencoder Features
FEATURE_KEYS = [
    'setting1', 'setting2', 'T24', 'T30', 'T50', 'P15',
    'P30', 'Nf', 'Nc', 'Ps30', 'phi', 'NRf',
    'NRc', 'BPR', 'htBleed', 'W31', 'W32', 'oilTemp', 'vibration'
]

# Physical Subsystem Mapping
SUBSYSTEM_MAP = {
    'T24': 'lpc',
    'P15': 'lpc',
    'T30': 'hpc',
    'P30': 'hpc',
    'Ps30': 'hpc',
    'Nc': 'hpc',
    'NRc': 'hpc',
    'T50': 'hpt',
    'W31': 'hpt',
    'W32': 'lpt',
    'BPR': 'lpt',
    'Nf': 'fan',
    'NRf': 'fan',
    'phi': 'combustor',
    'htBleed': 'combustor',
    'oilTemp': 'bearings',
    'vibration': 'bearings',
    'setting1': 'gearbox',
    'setting2': 'gearbox'
}

# Empirical Baseline Normalization Ranges
FEATURE_NORMS = {
    'setting1':  {'min': -0.008, 'max': 0.008,   'nominal': 0.0},
    'setting2':  {'min': -0.001, 'max': 0.001,   'nominal': 0.0},
    'T24':       {'min': 635.0,  'max': 650.0,   'nominal': 642.0},
    'T30':       {'min': 1550.0, 'max': 1630.0,  'nominal': 1585.0},
    'T50':       {'min': 1360.0, 'max': 1460.0,  'nominal': 1400.0},
    'P15':       {'min': 20.0,   'max': 23.0,    'nominal': 21.6},
    'P30':       {'min': 540.0,  'max': 570.0,   'nominal': 554.0},
    'Nf':        {'min': 2380.0, 'max': 2395.0,  'nominal': 2388.0},
    'Nc':        {'min': 8950.0, 'max': 9200.0,  'nominal': 9050.0},
    'Ps30':      {'min': 45.0,   'max': 49.0,    'nominal': 47.3},
    'phi':       {'min': 515.0,  'max': 530.0,   'nominal': 521.0},
    'NRf':       {'min': 2380.0, 'max': 2395.0,  'nominal': 2388.0},
    'NRc':       {'min': 8050.0, 'max': 8250.0,  'nominal': 8130.0},
    'BPR':       {'min': 8.1,    'max': 8.7,     'nominal': 8.4},
    'htBleed':   {'min': 385.0,  'max': 400.0,   'nominal': 392.0},
    'W31':       {'min': 37.5,   'max': 40.0,    'nominal': 38.8},
    'W32':       {'min': 22.5,   'max': 24.0,    'nominal': 23.3},
    'oilTemp':   {'min': 70.0,   'max': 110.0,   'nominal': 82.5},
    'vibration': {'min': 0.2,    'max': 3.5,     'nominal': 0.85}
}

# Calibrated Baseline Residuals for Differential Anomaly Attribution
BASELINE_RESIDUALS = {
    'setting1': 0.5050, 'setting2': 0.5517, 'T24': 31.2489, 'T30': 0.0643,
    'T50': 0.1442, 'P15': 0.0504, 'P30': 0.4275, 'Nf': 0.2923,
    'Nc': 0.3305, 'Ps30': 0.2191, 'phi': 0.1587, 'NRf': 0.0676,
    'NRc': 0.1490, 'BPR': 0.1999, 'htBleed': 0.0889, 'W31': 0.1328,
    'W32': 0.0913, 'oilTemp': 0.1343, 'vibration': 0.2037
}

MAE_BASELINE = 1.8122
WARNING_THRESHOLD_MAE = 1.8200
CRITICAL_THRESHOLD_MAE = 1.8320

_loaded_model = None

def get_model():
    global _loaded_model
    if _loaded_model is None:
        if not MODEL_PATH or not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Trained model 'full_autoencoder.keras' not found at {MODEL_PATH}")
        import tensorflow as tf
        _loaded_model = tf.keras.models.load_model(MODEL_PATH)
    return _loaded_model

def extract_feature_vector(point: dict) -> np.ndarray:
    vec = []
    for key in FEATURE_KEYS:
        val = point.get(key)
        if val is None:
            if key == 'phi': val = point.get('fuelFlow', 38.8) * 13.4
            elif key == 'W31': val = point.get('fuelFlow', 38.8)
            elif key == 'W32': val = point.get('W38', 23.3)
            elif key == 'P15': val = point.get('P2', 14.6) * 1.48
            else: val = FEATURE_NORMS[key]['nominal']
            
        norm = FEATURE_NORMS[key]
        scaled = (float(val) - norm['min']) / max(1e-4, (norm['max'] - norm['min']))
        vec.append(np.clip(scaled, 0.0, 1.0))
    return np.array(vec, dtype=np.float32)

def detect_anomaly(telemetry_sequence: list) -> dict:
    """
    Runs full_autoencoder.keras inference on a sliding sequence of telemetry points.
    Computes overall MAE, delta residuals, severity classification, and affected subsystems.
    """
    if not telemetry_sequence:
        return {"success": False, "error": "No telemetry data provided"}

    vectors = [extract_feature_vector(p) for p in telemetry_sequence]
    if len(vectors) < 50:
        vectors = [vectors[0]] * (50 - len(vectors)) + vectors
    else:
        vectors = vectors[-50:]

    input_tensor = np.array(vectors, dtype=np.float32)[np.newaxis, :, :] # (1, 50, 19)

    model = get_model()
    reconstructed = model(input_tensor, training=False).numpy()

    # Reconstruction Error (MAE)
    abs_errors = np.abs(input_tensor[0] - reconstructed[0])
    overall_mae = float(np.mean(abs_errors))
    last_step_errors = abs_errors[-1]

    # Differential residuals per sensor
    delta_residuals = {}
    subsystem_impacts = {}
    for idx, key in enumerate(FEATURE_KEYS):
        raw_err = float(last_step_errors[idx])
        base_err = BASELINE_RESIDUALS.get(key, 0.2)
        delta = max(0.0, raw_err - base_err)
        delta_residuals[key] = round(delta, 4)
        
        sub = SUBSYSTEM_MAP.get(key, 'core')
        subsystem_impacts[sub] = subsystem_impacts.get(sub, 0.0) + delta

    # Dynamic Anomaly Score (0 - 100%)
    mae_delta = max(0.0, overall_mae - MAE_BASELINE)
    anomaly_score = float(np.clip((mae_delta / (CRITICAL_THRESHOLD_MAE - MAE_BASELINE)) * 100.0, 0.0, 100.0))

    if overall_mae >= CRITICAL_THRESHOLD_MAE or anomaly_score >= 75.0:
        severity = 'CRITICAL'
        is_anomaly = True
    elif overall_mae >= WARNING_THRESHOLD_MAE or anomaly_score >= 38.0:
        severity = 'WARNING'
        is_anomaly = True
    else:
        severity = 'NORMAL'
        is_anomaly = False

    # Top affected subsystems sorted by impact
    sorted_subs = sorted(subsystem_impacts.items(), key=lambda x: x[1], reverse=True)
    affected_subsystems = [sub for sub, impact in sorted_subs if impact > 0.05][:3]
    if is_anomaly and not affected_subsystems and sorted_subs:
        affected_subsystems = [sorted_subs[0][0]]

    return {
        "success": True,
        "model_name": "full_autoencoder.keras (LSTM Autoencoder)",
        "is_anomaly": is_anomaly,
        "severity": severity,
        "anomaly_score": round(anomaly_score, 1),
        "reconstruction_mae": round(overall_mae, 5),
        "baseline_mae": MAE_BASELINE,
        "warning_threshold": WARNING_THRESHOLD_MAE,
        "critical_threshold": CRITICAL_THRESHOLD_MAE,
        "affected_subsystems": affected_subsystems,
        "delta_residuals": delta_residuals
    }

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--json':
        input_data = json.loads(sys.stdin.read())
        seq = input_data.get('sequence', input_data.get('history', [input_data]))
        print(json.dumps(detect_anomaly(seq)))
    else:
        sample_seq = [{
            'cycle': i + 1,
            'T24': 642.0, 'T30': 1585.0, 'T50': 1400.0, 'P30': 554.0,
            'Ps30': 47.3, 'fuelFlow': 38.8, 'vibration': 0.82
        } for i in range(50)]
        print(json.dumps(detect_anomaly(sample_seq), indent=2))
