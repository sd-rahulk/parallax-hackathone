import { NextRequest, NextResponse } from "next/server";
import { evaluateAutoencoderAnomaly, AUTOENCODER_CONFIG } from "@/utils/mlAutoencoder";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const telemetry = body.telemetry || body;
    const history = body.history || [];

    const result = evaluateAutoencoderAnomaly(telemetry, history);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to execute ML anomaly detection"
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    model_name: AUTOENCODER_CONFIG.modelName,
    architecture: "Sequential LSTM Autoencoder (50 timesteps x 19 features)",
    sequence_length: AUTOENCODER_CONFIG.sequenceLength,
    feature_count: AUTOENCODER_CONFIG.featureCount,
    baseline_mae: AUTOENCODER_CONFIG.baselineMae,
    warning_threshold_mae: AUTOENCODER_CONFIG.warningThresholdMae,
    critical_threshold_mae: AUTOENCODER_CONFIG.criticalThresholdMae,
    status: "active and serving inference"
  });
}
