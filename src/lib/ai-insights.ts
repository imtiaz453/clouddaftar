import { prisma } from "@/lib/prisma";
import { getAiConfig, type AiConfig } from "@/lib/ai-config";

export type InsightSeverity = "info" | "warning" | "critical" | "success";

export interface AiInsight {
  id: string;
  module: string;
  title: string;
  message: string;
  severity: InsightSeverity;
  actionLabel?: string;
  actionHref?: string;
}

function moduleFromPath(path: string) {
  if (path.includes("/sales") || path.includes("/quotations") || path.includes("/customer-payments")) return "Sales";
  if (path.includes("/purchases") || path.includes("/supplier-payments")) return "Purchases";
  if (path.includes("/inventory")) return "Inventory";
  if (path.includes("/customers") || path.includes("/suppliers")) return "Contacts";
  if (
    path.includes("/accounts-") ||
    path.includes("/accounting") ||
    path.includes("/cash-flow") ||
    path.includes("/income-expense") ||
    path.includes("/reconciliation")
  ) return "Accounting";
  if (path.includes("/reports")) return "Reports";
  if (path.includes("/settings") || path.includes("/users") || path.includes("/billing")) return "Settings";
  if (path === "/" || path === "/dashboard") return "Dashboard";
  return "Workspace";
}

function pushInsight(insights: AiInsight[], insight: AiInsight) {
  if (!insights.some((item) => item.id === insight.id)) insights.push(insight);
}

async function buildRuleInsights(companyId: string, path: string): Promise<AiInsight[]> {
  const module = moduleFromPath(path);
  const insights: AiInsight[] = [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [lowStock, outOfStock, unpaidSales, overdueSales, unpaidPurchases, overduePurchases, settings] =
    await Promise.all([
      prisma.product.count({ where: { companyId, deletedAt: null, isActive: true, isService: false, stock: { lte: prisma.product.fields.minStock, gt: 0 } } }),
      prisma.product.count({ where: { companyId, deletedAt: null, isActive: true, isService: false, stock: { lte: 0 } } }),
      prisma.sale.count({ where: { companyId, deletedAt: null, paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } } }),
      prisma.sale.count({ where: { companyId, deletedAt: null, dueDate: { lt: now }, paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } } }),
      prisma.purchase.count({ where: { companyId, deletedAt: null, paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } } }),
      prisma.purchase.count({ where: { companyId, deletedAt: null, dueDate: { lt: now }, paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } } }),
      prisma.companySettings.findUnique({ where: { companyId } }),
    ]);

  // ── Stock alerts (Inventory / Dashboard) ──
  if (outOfStock > 0 && ["Inventory", "Dashboard", "Workspace"].includes(module)) {
    pushInsight(insights, {
      id: "inventory-out-of-stock",
      module: "Inventory",
      title: `${outOfStock} products are out of stock`,
      message: `These products cannot be sold until restocked. ${lowStock > 0 ? `${lowStock} more are near minimum threshold.` : ""}`,
      severity: outOfStock > 5 ? "critical" : "warning",
      actionLabel: "View inventory",
      actionHref: "/inventory",
    });
  } else if (lowStock > 0 && ["Inventory", "Dashboard", "Workspace"].includes(module)) {
    pushInsight(insights, {
      id: "inventory-low-stock",
      module: "Inventory",
      title: `${lowStock} products nearing minimum stock`,
      message: "Review reorder quantities before these products sell out.",
      severity: lowStock > 10 ? "warning" : "info",
      actionLabel: "Review low stock",
      actionHref: "/inventory",
    });
  }

  // ── Overdue / unpaid receivables ──
  if (overdueSales > 0 && ["Sales", "Accounting", "Dashboard", "Reports", "Workspace"].includes(module)) {
    pushInsight(insights, {
      id: "sales-overdue",
      module: "Sales",
      title: `${overdueSales} customer invoices overdue`,
      message: "Overdue receivables tie up cash. Prioritize follow-up on aging invoices.",
      severity: overdueSales > 5 ? "critical" : "warning",
      actionLabel: "View receivables",
      actionHref: "/accounts-receivable",
    });
  } else if (unpaidSales > 0 && module === "Sales") {
    pushInsight(insights, {
      id: "sales-unpaid",
      module: "Sales",
      title: `${unpaidSales} invoices have outstanding balances`,
      message: "Record payments or send reminders to customers.",
      severity: "info",
      actionLabel: "Customer payments",
      actionHref: "/customer-payments",
    });
  }

  // ── Overdue / unpaid payables ──
  if (overduePurchases > 0 && ["Purchases", "Accounting", "Dashboard", "Reports", "Workspace"].includes(module)) {
    pushInsight(insights, {
      id: "purchase-overdue",
      module: "Purchases",
      title: `${overduePurchases} supplier bills overdue`,
      message: "Late payments may affect supplier relationships and credit terms.",
      severity: overduePurchases > 5 ? "critical" : "warning",
      actionLabel: "View payables",
      actionHref: "/accounts-payable",
    });
  } else if (unpaidPurchases > 0 && module === "Purchases") {
    pushInsight(insights, {
      id: "purchase-unpaid",
      module: "Purchases",
      title: `${unpaidPurchases} purchases unpaid`,
      message: "Record supplier payments or reconcile open balances.",
      severity: "info",
      actionLabel: "Supplier payments",
      actionHref: "/supplier-payments",
    });
  }

  // ── Cash flow gap warning (Accounting / Dashboard) ──
  if ((module === "Accounting" || module === "Dashboard") && overdueSales > 0 && overduePurchases > 0) {
    pushInsight(insights, {
      id: "cash-flow-gap",
      module: "Accounting",
      title: "Cash flow at risk",
      message: `You have ${overduePurchases} unpaid supplier bills but ${overdueSales} overdue customer invoices. Consider accelerating collections to cover payables.`,
      severity: overduePurchases > overdueSales ? "critical" : "warning",
      actionLabel: "Cash flow view",
      actionHref: "/cash-flow",
    });
  }

  // ── Draft sales (Sales page) ──
  if (module === "Sales") {
    const draftSales = await prisma.sale.count({ where: { companyId, deletedAt: null, status: "DRAFT" } });
    if (draftSales > 0) {
      pushInsight(insights, {
        id: "sales-drafts",
        module: "Sales",
        title: `${draftSales} draft sale${draftSales > 1 ? "s" : ""} not completed`,
        message: "Drafts left too long may have stale pricing or stock changes. Review and complete them.",
        severity: "warning",
        actionLabel: "View drafts",
        actionHref: "/sales?status=DRAFT",
      });
    }
  }

  // ── Recent returns (Sales page) ──
  if (module === "Sales") {
    const recentReturns = await prisma.sale.count({
      where: { companyId, deletedAt: null, status: { in: ["PARTIALLY_REFUNDED", "REFUNDED"] }, updatedAt: { gte: thirtyDaysAgo } },
    });
    if (recentReturns > 0) {
      pushInsight(insights, {
        id: "sales-recent-returns",
        module: "Sales",
        title: `${recentReturns} return${recentReturns > 1 ? "s" : ""} in last 30 days`,
        message: "High return rates may indicate product quality or customer satisfaction issues worth investigating.",
        severity: recentReturns > 5 ? "warning" : "info",
        actionLabel: "View sales",
        actionHref: "/sales",
      });
    }
  }

  // ── Pending / expiring quotations (Quotations page) ──
  if (module === "Sales" && path.includes("/quotations")) {
    const [pendingQuotes, expiringQuotes] = await Promise.all([
      prisma.quotation.count({ where: { companyId, deletedAt: null, status: "SENT" } }),
      prisma.quotation.count({ where: { companyId, deletedAt: null, status: "SENT", validUntil: { lt: now, gte: sixtyDaysAgo } } }),
    ]);
    if (expiringQuotes > 0) {
      pushInsight(insights, {
        id: "quotes-expiring",
        module: "Sales",
        title: `${expiringQuotes} quotation${expiringQuotes > 1 ? "s" : ""} expired or expiring`,
        message: "Follow up with customers before they lose interest or pricing becomes invalid.",
        severity: "warning",
        actionLabel: "View quotations",
        actionHref: "/quotations",
      });
    } else if (pendingQuotes > 0) {
      pushInsight(insights, {
        id: "quotes-pending",
        module: "Sales",
        title: `${pendingQuotes} quotation${pendingQuotes > 1 ? "s" : ""} awaiting customer response`,
        message: "Send gentle reminders or call to convert these into sales.",
        severity: "info",
        actionLabel: "View quotations",
        actionHref: "/quotations",
      });
    }
  }

  // ── Draft purchases (Purchases page) ──
  if (module === "Purchases") {
    const draftPurchases = await prisma.purchase.count({ where: { companyId, deletedAt: null, status: "DRAFT" } });
    if (draftPurchases > 0) {
      pushInsight(insights, {
        id: "purchase-drafts",
        module: "Purchases",
        title: `${draftPurchases} draft purchase${draftPurchases > 1 ? "s" : ""} pending`,
        message: "Pending purchase orders may delay inventory restocking. Submit them to avoid shortages.",
        severity: "warning",
        actionLabel: "View purchases",
        actionHref: "/purchases",
      });
    }
  }

  // ── Slow-moving stock (Inventory page) ──
  if (module === "Inventory") {
    const slowMoving = await prisma.product.count({
      where: { companyId, deletedAt: null, isActive: true, isService: false, stock: { gt: 0 }, updatedAt: { lt: sixtyDaysAgo } },
    });
    if (slowMoving > 0) {
      pushInsight(insights, {
        id: "inventory-slow-moving",
        module: "Inventory",
        title: `${slowMoving} product${slowMoving > 1 ? "s" : ""} have not moved in 60 days`,
        message: "Slow-moving stock ties up capital. Consider promotions, bundles, or markdowns.",
        severity: slowMoving > 10 ? "warning" : "info",
        actionLabel: "View inventory",
        actionHref: "/inventory",
      });
    }
  }

  // ── Expiring products (Inventory page) ──
  if (module === "Inventory") {
    const expiringSoon = await prisma.product.count({
      where: { companyId, deletedAt: null, isActive: true, isService: false, expiryDate: { lte: thirtyDaysAgo, gte: now }, NOT: { expiryDate: null } },
    });
    const alreadyExpired = await prisma.product.count({
      where: { companyId, deletedAt: null, isActive: true, isService: false, expiryDate: { lt: now }, NOT: { expiryDate: null } },
    });
    if (alreadyExpired > 0) {
      pushInsight(insights, {
        id: "inventory-expired",
        module: "Inventory",
        title: `${alreadyExpired} product${alreadyExpired > 1 ? "s" : ""} past expiry date`,
        message: "Expired products should be removed from active inventory immediately.",
        severity: "critical",
        actionLabel: "Review inventory",
        actionHref: "/inventory",
      });
    } else if (expiringSoon > 0) {
      pushInsight(insights, {
        id: "inventory-expiring",
        module: "Inventory",
        title: `${expiringSoon} product${expiringSoon > 1 ? "s" : ""} expiring in 30 days`,
        message: "Run promotions or bundle deals to clear soon-to-expire stock before it becomes unsellable.",
        severity: "warning",
        actionLabel: "Review inventory",
        actionHref: "/inventory",
      });
    }
  }

  // ── Inactive customers (Contacts / Dashboard) ──
  if ((module === "Contacts" || module === "Dashboard") && path.includes("/customers")) {
    const inactiveCustomers = await prisma.customer.count({
      where: { companyId, deletedAt: null, isActive: true, updatedAt: { lt: sixtyDaysAgo } },
    });
    if (inactiveCustomers > 0) {
      pushInsight(insights, {
        id: "customers-inactive",
        module: "Contacts",
        title: `${inactiveCustomers} customer${inactiveCustomers > 1 ? "s" : ""} inactive for 60+ days`,
        message: "Re-engage with a targeted email or call campaign to win back dormant customers.",
        severity: "info",
        actionLabel: "View customers",
        actionHref: "/customers",
      });
    }
  }

  // ── Top customers (Customers page) ──
  if (module === "Contacts" && path.includes("/customers")) {
    const topCustomers = await prisma.sale.groupBy({
      by: ["customerId"],
      where: { companyId, deletedAt: null, customerId: { not: null } },
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 3,
    });
    if (topCustomers.length > 0) {
      const customerIds = topCustomers.map((c) => c.customerId).filter(Boolean) as string[];
      const names = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(names.map((n) => [n.id, n.name]));
      const topNames = topCustomers.slice(0, 3).map((c) => nameMap.get(c.customerId!) || "Unknown").join(", ");
      pushInsight(insights, {
        id: "customers-top",
        module: "Contacts",
        title: "Your top revenue-driving customers",
        message: `Focus retention efforts on: ${topNames}. A 5% increase in retention can boost profits significantly.`,
        severity: "success",
        actionLabel: "View customers",
        actionHref: "/customers",
      });
    }
  }

  // ── Reconciliation page: suggest starting a session ──
  if (module === "Accounting" && path.includes("/reconciliation")) {
    const totalEntries = await prisma.ledgerEntry.count({ where: { companyId } });
    if (totalEntries > 50) {
      pushInsight(insights, {
        id: "accounting-reconciliation-suggest",
        module: "Accounting",
        title: `${totalEntries} ledger entries to review`,
        message: "Regular reconciliation helps catch discrepancies early and keeps your books accurate.",
        severity: "info",
        actionLabel: "Start reconciliation",
        actionHref: "/reconciliation",
      });
    }
  }

  // ── Recent sales trend (Dashboard) ──
  if (module === "Dashboard") {
    const [recentSales, olderSales, draftCount, pendingQuotesCount] = await Promise.all([
      prisma.sale.aggregate({ where: { companyId, deletedAt: null, createdAt: { gte: thirtyDaysAgo }, status: { not: "DRAFT" } }, _sum: { total: true } }),
      prisma.sale.aggregate({ where: { companyId, deletedAt: null, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, status: { not: "DRAFT" } }, _sum: { total: true } }),
      prisma.sale.count({ where: { companyId, deletedAt: null, status: "DRAFT" } }),
      prisma.quotation.count({ where: { companyId, deletedAt: null, status: { in: ["DRAFT", "SENT"] } } }),
    ]);
    const recentTotal = Number(recentSales._sum.total || 0);
    const olderTotal = Number(olderSales._sum.total || 0);
    if (olderTotal > 0) {
      const change = ((recentTotal - olderTotal) / olderTotal) * 100;
      if (Math.abs(change) > 10) {
        pushInsight(insights, {
          id: "dashboard-sales-trend",
          module: "Dashboard",
          title: `Sales ${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(0)}% vs prior period`,
          message: change > 0
            ? `Great momentum! Total sales reached ${formatCurrency(recentTotal)} in the last 30 days.`
            : `Sales declined to ${formatCurrency(recentTotal)}. Review pricing, marketing, or product mix.`,
          severity: change > 0 ? "success" : "warning",
          actionLabel: "View sales",
          actionHref: "/sales",
        });
      }
    }
    if (draftCount > 0 || pendingQuotesCount > 0) {
      pushInsight(insights, {
        id: "dashboard-pending-items",
        module: "Dashboard",
        title: `${draftCount + pendingQuotesCount} pending item${draftCount + pendingQuotesCount > 1 ? "s" : ""} need attention`,
        message: `${draftCount} draft sale${draftCount !== 1 ? "s" : ""} and ${pendingQuotesCount} open quotation${pendingQuotesCount !== 1 ? "s" : ""} waiting.`,
        severity: "info",
        actionLabel: "View sales",
        actionHref: "/sales",
      });
    }
  }

  // ── Reports page: suggest relevant reports ──
  if (module === "Reports") {
    if (overdueSales > 0 || overduePurchases > 0) {
      pushInsight(insights, {
        id: "reports-aging-suggest",
        module: "Reports",
        title: "Run an aging report to track overdue amounts",
        message: `${overdueSales > 0 ? `${overdueSales} overdue receivables. ` : ""}${overduePurchases > 0 ? `${overduePurchases} overdue payables. ` : ""}An aging report gives you a clear picture.`,
        severity: "info",
        actionLabel: "Run aging report",
        actionHref: "/reports?type=aging",
      });
    }
    if (lowStock > 0 || outOfStock > 0) {
      pushInsight(insights, {
        id: "reports-stock-suggest",
        module: "Reports",
        title: `${outOfStock + lowStock} product${outOfStock + lowStock > 1 ? "s" : ""} with stock issues`,
        message: "Run an inventory valuation or stock summary report to plan your next purchase order.",
        severity: "info",
        actionLabel: "Run stock report",
        actionHref: "/reports?type=inventory",
      });
    }
  }

  // ── Tax compliance setup warning (Settings) ──
  if (settings?.taxComplianceMode && settings.taxComplianceMode !== "NONE" && (module === "Settings" || module === "Dashboard")) {
    const needsTaxSetup = settings.taxComplianceMode === "FBR"
      ? !settings.fbrPosId
      : !(settings.zatcaSettings as Record<string, unknown> | null)?.vatRegNo;
    if (needsTaxSetup) {
      pushInsight(insights, {
        id: "tax-setup-incomplete",
        module: "Settings",
        title: `${settings.taxComplianceMode} setup incomplete`,
        message: "Tax compliance is enabled but required registration details are missing. Complete setup to avoid compliance gaps on invoices.",
        severity: "warning",
        actionLabel: "Open tax settings",
        actionHref: "/settings?tab=tax-compliance",
      });
    }
  }

  // ── Fallback: all clear ──
  if (insights.length === 0) {
    const recentSalesCount = await prisma.sale.count({ where: { companyId, deletedAt: null, createdAt: { gte: thirtyDaysAgo } } });
    const customerCount = await prisma.customer.count({ where: { companyId, deletedAt: null } });
    const productCount = await prisma.product.count({ where: { companyId, deletedAt: null, isActive: true } });
    pushInsight(insights, {
      id: "all-clear",
      module,
      title: recentSalesCount > 0 ? `Steady operations — ${recentSalesCount} sales this month` : "No urgent issues detected",
      message: recentSalesCount > 0
        ? `${productCount} active products, ${customerCount} customers, ${recentSalesCount} sales in 30 days. Everything looks healthy.`
        : "The background checks did not find immediate stock, receivable, payable, or setup risks.",
      severity: "success",
    });
  }

  return insights;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

async function enhanceWithProvider(config: AiConfig, insights: AiInsight[]) {
  if (!config.enabled || config.provider === "local" || !config.apiKey) return insights;

  const prompt = `${config.systemPrompt}\n\nRewrite these ERP insights to be concise and practical. Return JSON array with title and message only, preserving order:\n${JSON.stringify(insights.map(({ title, message }) => ({ title, message })))}`;

  try {
    const text = config.provider === "openrouter"
      ? await callOpenRouter(config, prompt)
      : await callGemini(config, prompt);
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
    if (!Array.isArray(parsed)) return insights;
    return insights.map((insight, index) => ({
      ...insight,
      title: typeof parsed[index]?.title === "string" ? parsed[index].title.slice(0, 90) : insight.title,
      message: typeof parsed[index]?.message === "string" ? parsed[index].message.slice(0, 220) : insight.message,
    }));
  } catch {
    return insights;
  }
}

async function callOpenRouter(config: AiConfig, prompt: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://clouddaftar.local", "X-Title": "Cloud Daftar" },
    body: JSON.stringify({ model: config.model || "google/gemini-flash-1.5", messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: 1000 }),
  });
  if (!res.ok) throw new Error("OpenRouter request failed");
  const json = await res.json();
  return json.choices?.[0]?.message?.content || "[]";
}

async function callGemini(config: AiConfig, prompt: string) {
  const model = encodeURIComponent(config.model || "gemini-1.5-flash");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1000 } }),
  });
  if (!res.ok) throw new Error("Gemini request failed");
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
}

export async function getCompanyAiInsights(companyId: string, path: string) {
  const config = await getAiConfig();
  if (!config.enabled) return { enabled: false, provider: config.provider, insights: [] };
  const ruleInsights = await buildRuleInsights(companyId, path);
  const insights = await enhanceWithProvider(config, ruleInsights);
  return { enabled: true, provider: config.provider, insights };
}
