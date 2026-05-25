"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

const IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

export function IdleLogoutProvider() {
  const { status } = useSession();
  const timeoutRef = useRef<number | null>(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (status !== "authenticated") return;

    function clearTimer() {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function logoutIfIdle() {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_TIMEOUT_MS) {
        void signOut({ callbackUrl: "/login?reason=idle" });
        return;
      }
      timeoutRef.current = window.setTimeout(logoutIfIdle, IDLE_TIMEOUT_MS - idleFor);
    }

    function markActivity() {
      lastActivityRef.current = Date.now();
      clearTimer();
      timeoutRef.current = window.setTimeout(logoutIfIdle, IDLE_TIMEOUT_MS);
    }

    markActivity();
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, markActivity, { passive: true });
    });

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, markActivity);
      });
    };
  }, [status]);

  return null;
}
