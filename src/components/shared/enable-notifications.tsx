"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function EnableNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const subscribe = useCallback(async () => {
    if (permission === "unsupported") return;
    setLoading(true);

    try {
      if (permission === "denied") {
        return;
      }

      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
        setPermission(perm);
      }

      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;

      const vapidRes = await fetch("/api/push/vapid-key");
      const vapidData = await vapidRes.json();
      const publicKey = vapidData.data?.publicKey;
      if (!publicKey) return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });

      const subJSON = sub.toJSON();
      if (!subJSON.endpoint || !subJSON.keys) return;

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          p256dh: subJSON.keys.p256dh,
          auth: subJSON.keys.auth,
          userAgent: navigator.userAgent,
        }),
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [permission]);

  if (permission === "unsupported") return null;

  return (
    <button
      type="button"
      onClick={subscribe}
      disabled={loading || permission === "granted"}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      title={
        permission === "granted"
          ? "Notifications are enabled"
          : permission === "denied"
            ? "Notifications are blocked"
            : "Enable notifications"
      }
    >
      {permission === "granted" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      <span className="hidden lg:inline">
        {loading ? "Enabling..." : permission === "granted" ? "Notifications On" : permission === "denied" ? "Blocked" : "Notify Me"}
      </span>
    </button>
  );
}
