"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function RouteLoadingOverlay() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const lastRouteKey = useRef(routeKey);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide loading when route key changes
  useEffect(() => {
    if (!loadingRef.current) return;
    if (lastRouteKey.current === routeKey) return;
    lastRouteKey.current = routeKey;
    loadingRef.current = false;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setLoading(false);
  }, [routeKey]);

  useEffect(() => {
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

      if (hideTimer.current) clearTimeout(hideTimer.current);
      loadingRef.current = true;
      setLoading(true);
      hideTimer.current = setTimeout(() => {
        loadingRef.current = false;
        setLoading(false);
      }, 10000);
    }

    function handleProgrammaticNavigation() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      loadingRef.current = true;
      setLoading(true);
      hideTimer.current = setTimeout(() => {
        loadingRef.current = false;
        setLoading(false);
      }, 10000);
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("route-loading-start", handleProgrammaticNavigation);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("route-loading-start", handleProgrammaticNavigation);
    };
  }, []);

  if (!loading) return null;

  return (
    <div className="route-loading-overlay" aria-live="polite">
      <div className="route-loading-panel">
        <LoadingSpinner size={8} />
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
