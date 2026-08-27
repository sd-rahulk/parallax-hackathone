import { NextRequest, NextResponse } from "next/server";
import { predictEngineHealth, getAll50Recommendations } from "@/utils/engineRecommender";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const telemetry = body.telemetry || body;
    const recommendation = predictEngineHealth(telemetry);

    return NextResponse.json({
      success: true,
      ...recommendation
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to generate recommendation"
      },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const showCatalog = searchParams.get("catalog") === "true" || searchParams.get("all") === "true";

  if (showCatalog) {
    const catalog = getAll50Recommendations();
    return NextResponse.json({
      success: true,
      total_catalog_rules: catalog.length,
      catalog
    });
  }

  // Return sample prediction for quick verification
  const sample = predictEngineHealth({
    T30: 1638.2,
    P30: 536.1,
    T50: 1408.0,
    Ps30: 46.1
  });

  return NextResponse.json({
    info: "Aircraft Engine Health Monitoring & 50-Fault Predictive Maintenance Recommender API (PS-S02)",
    sample_prediction: sample
  });
}
