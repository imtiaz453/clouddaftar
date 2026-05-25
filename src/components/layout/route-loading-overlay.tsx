"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LinesLoader } from "@/components/ui/lines-loader";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function RouteLoadingOverlay() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const routeChanged = useRef(false);
  const startedAt = useRef(0);
  const pendingRequests = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRouteKey = useRef(routeKey);

  useEffect(() => {
    function clearTimers() {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      stopTimer.current = null;
      fallbackTimer.current = null;
    }

    function finishLoading() {
      clearTimers();
      loadingRef.current = false;
      routeChanged.current = false;
      pendingRequests.current = 0;
      setLoading(false);
    }

    function maybeFinishLoading() {
      if (!loadingRef.current || !routeChanged.current || pendingRequests.current > 0) return;

      const elapsed = Date.now() - startedAt.current;
      const delay = Math.max(250, 900 - elapsed);
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(() => {
        if (pendingRequests.current === 0) finishLoading();
      }, delay);
    }

    function startLoading() {
      clearTimers();
      startedAt.current = Date.now();
      routeChanged.current = false;
      pendingRequests.current = 0;
      loadingRef.current = true;
      setLoading(true);
      fallbackTimer.current = setTimeout(finishLoading, 20000);
    }

    function handleClick(event: MouseEvent) {
      if (isModifiedClick(event) || event.defaultPrevented) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const nextRoute = `${url.pathname}${url.search}`;
      const currentRoute = `${window.location.pathname}${window.location.search}`;
      if (nextRoute === currentRoute || url.hash) return;

      startLoading();
    }

    function handleProgrammaticNavigation() {
      startLoading();
    }

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      if (loadingRef.current) pendingRequests.current += 1;
      try {
        return await originalFetch(...args);
      } finally {
        if (loadingRef.current) {
          pendingRequests.current = Math.max(0, pendingRequests.current - 1);
          maybeFinishLoading();
        }
      }
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("route-loading-start", handleProgrammaticNavigation);
    return () => {
      clearTimers();
      window.fetch = originalFetch;
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("route-loading-start", handleProgrammaticNavigation);
    };
  }, []);

  useEffect(() => {
    if (!loadingRef.current || lastRouteKey.current === routeKey) return;
    lastRouteKey.current = routeKey;
    routeChanged.current = true;

    const waitForMountedFetches = setTimeout(() => {
      if (!loadingRef.current || pendingRequests.current > 0) return;
      const elapsed = Date.now() - startedAt.current;
      const delay = Math.max(250, 900 - elapsed);
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(() => {
        if (pendingRequests.current === 0) {
          loadingRef.current = false;
          routeChanged.current = false;
          setLoading(false);
        }
      }, delay);
    }, 350);

    return () => clearTimeout(waitForMountedFetches);
  }, [routeKey]);

  if (!loading) return null;

  return (
    <div className="route-loading-overlay" aria-live="polite">
      <div className="route-loading-panel">
        <LinesLoader size="sm" label="Loading route..." />
      </div>
    </div>
  );
}
