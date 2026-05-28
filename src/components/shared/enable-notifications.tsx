"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff } from "lucide-react";
import { useToast } from "@/providers/toast-provider";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function EnableNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (Notification.permission !== "granted") return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(!!sub);
      } catch {
        // service worker not ready yet
      }
    })();
    return () => { cancelled = true; };
  }, [permission]);

  const subscribe = useCallback(async () => {
    if (permission === "unsupported") return;
    setLoading(true);

    try {
      if (permission === "denied") {
        addToast({ title: "Notifications blocked", description: "Update your browser settings to enable notifications.", variant: "error" });
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
      if (!publicKey) {
        addToast({ title: "VAPID key not configured", variant: "error" });
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });

      const subJSON = sub.toJSON();
      if (!subJSON.endpoint || !subJSON.keys) return;

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          p256dh: subJSON.keys.p256dh,
          auth: subJSON.keys.auth,
          userAgent: navigator.userAgent,
        }),
      });
      if (res.ok) {
        setSubscribed(true);
        addToast({ title: "Notifications enabled", variant: "success" });
      }
    } catch (err) {
      console.error("Push subscription failed:", err);
      addToast({ title: "Failed to enable notifications", description: String(err), variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [permission, addToast]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setSubscribed(false);
      addToast({ title: "Notifications disabled", variant: "success" });
    } catch (err) {
      console.error("Failed to unsubscribe:", err);
      addToast({ title: "Failed to disable notifications", description: String(err), variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const toggle = useCallback(() => {
    if (subscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  }, [subscribed, subscribe, unsubscribe]);

  if (permission === "unsupported") return null;

  const isDenied = permission === "denied";

  return (
    <button
      type="button"
      onClick={isDenied ? undefined : toggle}
      disabled={loading || isDenied}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      title={
        isDenied
          ? "Notifications blocked in browser settings"
          : subscribed
            ? "Turn off notifications"
            : "Turn on notifications"
      }
    >
      {subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      <span className="hidden lg:inline">
        {loading ? "..." : isDenied ? "Blocked" : subscribed ? "Notifications On" : "Notify Me"}
      </span>
    </button>
  );
}
