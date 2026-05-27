"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

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
        <svg
          className="h-8 w-8 animate-spin text-neutral-tertiary"
          viewBox="0 0 100 101"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
            fill="currentColor"
          />
          <path
            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
            fill="currentColor"
            className="text-fg-brand"
          />
        </svg>
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
