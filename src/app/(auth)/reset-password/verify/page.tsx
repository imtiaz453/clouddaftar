"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/providers/toast-provider";

function VerifyResetCodeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const initialEmail = useMemo(() => searchParams?.get("email") || "", [searchParams]);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(10 * 60);
  const [resendAfter, setResendAfter] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(value - 1, 0));
      setResendAfter((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to verify this code");
      }

      addToast({
        title: "Code verified",
        description: "Create your new password.",
        variant: "success",
      });
      router.push(data.redirectTo || "/reset-password/new");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to verify this code";
      setError(message);
      addToast({ title: "Verification failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError("");

    try {
      const res = await fetch("/api/auth/password-reset/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to resend verification code");
      }

      setCode("");
      setSecondsLeft(10 * 60);
      setResendAfter(Number(data.resendAfterSeconds || 60));
      addToast({
        title: "Verification code sent",
        description: data.message,
        variant: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to resend verification code";
      setError(message);
      addToast({ title: "Resend failed", description: message, variant: "error" });
    } finally {
      setResending(false);
    }
  }

  return (
    <Card className="shadow-slate-950/16 overflow-hidden rounded-[1.75rem] border-white/80 bg-white/95 shadow-2xl ring-1 ring-slate-950/5 backdrop-blur">
      <CardHeader className="items-center border-b border-slate-200/70 px-7 pb-6 pt-8 text-center sm:px-10">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl border border-blue-100 bg-blue-50 shadow-inner">
          <ShieldCheck className="h-9 w-9 text-blue-600" />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
          Verify identity
        </p>
        <CardTitle className="text-3xl font-black tracking-tight text-slate-950">
          Enter verification code
        </CardTitle>
        <CardDescription className="max-w-sm text-sm font-medium text-slate-500">
          Enter the 6-digit code sent to your email. It expires in {countdown}.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-7 py-7 sm:px-10">
        <form onSubmit={handleVerify} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-14 rounded-xl border-slate-300 text-base font-semibold shadow-sm"
            required
          />
          <Input
            label="Verification code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-14 rounded-xl border-slate-300 text-center text-xl font-black tracking-[0.35em] shadow-sm"
            required
          />
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="h-14 w-full rounded-xl bg-blue-600 text-base font-black text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
            disabled={loading || code.length !== 6}
          >
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Verify code
          </Button>
        </form>

        <div className="mt-5 flex flex-col gap-3 text-center text-sm font-bold">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-xl border-slate-300 bg-white font-bold shadow-sm"
            onClick={handleResend}
            disabled={resending || resendAfter > 0 || !email}
          >
            {resending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            {resendAfter > 0 ? `Resend in ${resendAfter}s` : "Resend code"}
          </Button>
          <Link href="/forgot-password" className="text-slate-500 hover:text-blue-700">
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Use a different email
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyResetCodePage() {
  return (
    <Suspense
      fallback={
        <Card className="shadow-slate-950/16 overflow-hidden rounded-[1.75rem] border-white/80 bg-white/95 shadow-2xl ring-1 ring-slate-950/5 backdrop-blur">
          <CardContent className="flex items-center justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </CardContent>
        </Card>
      }
    >
      <VerifyResetCodeForm />
    </Suspense>
  );
}
