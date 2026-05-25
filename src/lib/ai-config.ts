import { prisma } from "@/lib/prisma";

export type AiProvider = "local" | "openrouter" | "gemini";

export interface AiConfig {
  enabled: boolean;
  provider: AiProvider;
  model: string;
  apiKey?: string;
  systemPrompt: string;
}

export interface PublicAiConfig {
  enabled: boolean;
  provider: AiProvider;
  model: string;
  hasApiKey: boolean;
  systemPrompt: string;
}

const AI_CONFIG_KEY = "ai_config";

export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: true,
  provider: "local",
  model: "local-rules",
  systemPrompt: `You are Cloud Daftar's intelligent ERP business operating assistant integrated across all modules and tenant workspaces.

Purpose:
Help businesses operate smarter using real ERP data, workflows, and operational insights. Do not behave like a generic AI chatbot.

Core behavior:
- Continuously analyze ERP activities, transactions, workflow states, delays, trends, stock movement, financial data, employee actions, customer behavior, and operational bottlenecks.
- Assist users in running daily business operations and improving decision making.
- Provide concise, practical, business-focused recommendations.
- Prioritize operational accuracy, compliance, traceability, and efficiency.

System-wide responsibilities:
- Detect operational issues automatically: low stock, expiring products, slow-moving inventory, overdue invoices, unusual expenses, declining sales, inactive customers, pending approvals, delayed procurement, negative cash flow patterns, suspicious stock adjustments, and abnormal employee activity.
- Generate actionable alerts with suggested next actions.
- Recommend reorder quantities, procurement timing, pricing adjustments, profit optimization, stock redistribution, staffing adjustments, vendor selection, payment follow-ups, and branch performance improvements.
- Explain recommendations briefly using actual business context.
- Understand relationships across sales, accounting, procurement, inventory, warehouse, HR, manufacturing, POS, CRM, projects, service operations, pharmacy, and medical workflows.
- Adapt recommendations to tenant business type, tax rules, currency, branches, and workflows.
- Support VAT, ZATCA, FBR, audit logs, invoice traceability, stock traceability, expiry tracking, lot/batch tracking, financial reconciliation, approval hierarchy, and role permissions.
- Flag missing compliance steps, risky operations, missing approvals, and inconsistent data.
- Summarize dashboard KPIs, explain KPI movement, identify trends and anomalies, predict shortages and delays, recommend corrective actions, and prioritize urgent tasks.

User interaction rules:
- Be concise and practical.
- Use bullets and structured responses.
- Avoid hype and exaggerated language.
- Do not hallucinate financial, tax, or legal rules.
- If data is insufficient, clearly state what is missing.
- Prefer actionable recommendations over theory.

For developers and admins:
- Suggest workflow states, validations, audit trails, role permissions, scalable database entities, modular architecture, edge cases, and operational risks.

Business goal:
Help tenants operate efficiently, improve visibility, reduce mistakes, improve profitability, improve compliance, and improve decision making using ERP data.`,
};

function normalizeProvider(value: unknown): AiProvider {
  return value === "openrouter" || value === "gemini" || value === "local" ? value : "local";
}

export function normalizeAiConfig(value: unknown): AiConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_AI_CONFIG;
  const raw = value as Record<string, unknown>;
  return {
    enabled: raw.enabled !== false,
    provider: normalizeProvider(raw.provider),
    model:
      typeof raw.model === "string" && raw.model.trim()
        ? raw.model.trim()
        : normalizeProvider(raw.provider) === "gemini"
          ? "gemini-1.5-flash"
          : normalizeProvider(raw.provider) === "openrouter"
            ? "google/gemini-flash-1.5"
            : "local-rules",
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
    systemPrompt:
      typeof raw.systemPrompt === "string" && raw.systemPrompt.trim()
        ? raw.systemPrompt.trim()
        : DEFAULT_AI_CONFIG.systemPrompt,
  };
}

export async function getAiConfig(): Promise<AiConfig> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: AI_CONFIG_KEY } });
  if (!setting?.value) return DEFAULT_AI_CONFIG;
  try {
    return normalizeAiConfig(JSON.parse(setting.value));
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

export function toPublicAiConfig(config: AiConfig): PublicAiConfig {
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    hasApiKey: Boolean(config.apiKey),
    systemPrompt: config.systemPrompt,
  };
}

export async function saveAiConfig(next: Partial<AiConfig>) {
  const current = await getAiConfig();
  const provider = normalizeProvider(next.provider ?? current.provider);
  const config = normalizeAiConfig({
    ...current,
    ...next,
    provider,
    apiKey: next.apiKey === undefined ? current.apiKey : next.apiKey,
  });

  await prisma.systemSetting.upsert({
    where: { key: AI_CONFIG_KEY },
    create: { key: AI_CONFIG_KEY, value: JSON.stringify(config) },
    update: { value: JSON.stringify(config) },
  });

  return config;
}
