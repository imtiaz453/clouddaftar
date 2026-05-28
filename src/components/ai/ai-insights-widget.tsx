"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Brain,
  Check,
  CheckCircle2,
  EyeOff,
  MoreHorizontal,
  Pin,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dashboardHref } from "@/lib/dashboard-href";
import { cn } from "@/lib/utils";

interface AiInsight {
  id: string;
  module: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical" | "success";
  actionLabel?: string;
  actionHref?: string;
}

const severityStyle = {
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  critical:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

const AI_WIDGET_DISPLAY_KEY = "cloud-daftar-ai-widget-display";
const AI_WIDGET_CACHE_PREFIX = "cloud-daftar-ai-insights";
const AI_WIDGET_CACHE_MS = 5 * 60 * 1000;
const HIDDEN_POPUP_DURATION_MS = 5000;
const AI_FETCH_DELAY_MS = 4500;
const AI_HIDDEN_FETCH_DELAY_MS = 12000;

type AiWidgetDisplay = "permanent" | "hidden";

function InsightIcon({ severity }: { severity: AiInsight["severity"] }) {
  if (severity === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (severity === "warning" || severity === "critical")
    return <TriangleAlert className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}

export function AiInsightsWidget() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [provider, setProvider] = useState("local");
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [displayMode, setDisplayMode] = useState<AiWidgetDisplay>("permanent");
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [showHiddenPopup, setShowHiddenPopup] = useState(false);
  const [lastPopupKey, setLastPopupKey] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(AI_WIDGET_DISPLAY_KEY);
    if (saved === "hidden" || saved === "permanent") {
      setDisplayMode(saved);
    }
    setPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferenceLoaded) return;

    window.localStorage.setItem(AI_WIDGET_DISPLAY_KEY, displayMode);
    if (displayMode === "permanent") {
      setShowHiddenPopup(false);
    } else {
      setOpen(false);
    }
  }, [displayMode, preferenceLoaded]);

  useEffect(() => {
    if (!preferenceLoaded) return;
    const controller = new AbortController();
    const cacheKey = `${AI_WIDGET_CACHE_PREFIX}:${pathname}`;

    try {
      const cached = window.sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.createdAt < AI_WIDGET_CACHE_MS) {
          setEnabled(parsed.data.enabled);
          setProvider(parsed.data.provider);
          setInsights(parsed.data.insights || []);
          return () => controller.abort();
        }
      }
    } catch {}

    const delay = open
      ? 0
      : displayMode === "hidden"
        ? AI_HIDDEN_FETCH_DELAY_MS
        : AI_FETCH_DELAY_MS;
    let idleId: number | null = null;

    const timer = window.setTimeout(() => {
      const run = () => {
        if (document.hidden && !open) return;
        setLoading(true);
        fetch(`/api/ai/insights?path=${encodeURIComponent(pathname)}`, {
          signal: controller.signal,
        })
          .then((res) => res.json())
          .then((json) => {
            if (json.success) {
              setEnabled(json.data.enabled);
              setProvider(json.data.provider);
              setInsights(json.data.insights || []);
              try {
                window.sessionStorage.setItem(
                  cacheKey,
                  JSON.stringify({ createdAt: Date.now(), data: json.data }),
                );
              } catch {}
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      };

      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(run, { timeout: 3000 });
      } else {
        run();
      }
    }, delay);

    return () => {
      window.clearTimeout(timer);
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      controller.abort();
    };
  }, [displayMode, open, pathname, preferenceLoaded]);

  const activeCount = useMemo(
    () => insights.filter((item) => item.severity !== "success").length,
    [insights],
  );
  const hasMessages = insights.length > 0;
  const topInsight = insights.find((item) => item.severity !== "success") || insights[0];
  const shouldShowButton = displayMode === "permanent" || open || showHiddenPopup;
  const insightKey = useMemo(
    () => insights.map((item) => `${item.id}:${item.severity}`).join("|"),
    [insights],
  );

  useEffect(() => {
    if (displayMode !== "hidden" || open || loading || !hasMessages || !insightKey) return;
    if (lastPopupKey === insightKey) return;

    setLastPopupKey(insightKey);
    setShowHiddenPopup(true);
    const timer = window.setTimeout(() => {
      setShowHiddenPopup(false);
    }, HIDDEN_POPUP_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [displayMode, hasMessages, insightKey, lastPopupKey, loading, open]);

  if (!enabled) return null;
  if (!shouldShowButton) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {showHiddenPopup && !open && topInsight && (
        <button
          type="button"
          onClick={() => {
            setShowHiddenPopup(false);
            setOpen(true);
          }}
          className="mb-3 w-[calc(100vw-2rem)] max-w-sm rounded-xl border bg-background p-3 text-left shadow-xl transition-colors hover:bg-accent"
        >
          <div className="flex items-start gap-3">
            <span
              className={cn("mt-0.5 rounded-full border p-2", severityStyle[topInsight.severity])}
            >
              <InsightIcon severity={topInsight.severity} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                {topInsight.title}
              </span>
              <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                {topInsight.message}
              </span>
            </span>
          </div>
        </button>
      )}
      {open && (
        <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm rounded-xl border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">AI Insights</p>
                <p className="text-xs text-muted-foreground">
                  {provider === "local" ? "Local rules engine" : provider}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="AI icon display"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>AI icon</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setDisplayMode("permanent")} className="gap-2">
                    <Pin className="h-4 w-4" />
                    Stay permanent
                    {displayMode === "permanent" && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDisplayMode("hidden")} className="gap-2">
                    <EyeOff className="h-4 w-4" />
                    Hide until needed
                    {displayMode === "hidden" && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Close insights"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <LoadingSpinner size={4} className="mr-2" />
                Checking workspace signals...
              </div>
            ) : (
              insights.map((insight) => (
                <div
                  key={insight.id}
                  className={cn("rounded-lg border p-3", severityStyle[insight.severity])}
                >
                  <div className="flex items-start gap-2">
                    <InsightIcon severity={insight.severity} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{insight.title}</p>
                      <p className="mt-1 text-xs leading-5 opacity-90">{insight.message}</p>
                      {insight.actionHref && insight.actionLabel && (
                        <Link
                          href={dashboardHref(pathname, insight.actionHref)}
                          className="mt-2 inline-flex text-xs font-semibold underline-offset-4 hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          {insight.actionLabel}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <Button
        onClick={() => {
          setShowHiddenPopup(false);
          setOpen((value) => !value);
        }}
        className="relative h-11 rounded-full px-4 shadow-lg"
      >
        <Brain className="mr-2 h-4 w-4" />
        AI
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </Button>
    </div>
  );
}
