import { NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin-auth";
import { getAiConfig, saveAiConfig, toPublicAiConfig } from "@/lib/ai-config";

export async function GET() {
  await requireAdmin();
  const config = await getAiConfig();
  return NextResponse.json({ success: true, data: toPublicAiConfig(config) });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  const body = await req.json();
  const current = await getAiConfig();
  const apiKey =
    typeof body.apiKey === "string" && body.apiKey.trim()
      ? body.apiKey.trim()
      : body.keepExistingKey
        ? current.apiKey
        : "";

  const config = await saveAiConfig({
    enabled: body.enabled !== false,
    provider: body.provider,
    model: body.model,
    systemPrompt: body.systemPrompt,
    apiKey,
  });

  await logAdminAction(session.admin.id, "AI_SETTINGS_UPDATED", "SystemSetting", "ai_config", {
    provider: config.provider,
    model: config.model,
    enabled: config.enabled,
    hasApiKey: Boolean(config.apiKey),
  });

  return NextResponse.json({ success: true, data: toPublicAiConfig(config) });
}
