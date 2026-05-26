"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/providers/toast-provider";

function getPasswordChecks(password: string) {
  return [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "One lowercase letter", valid: /[a-z]/.test(password) },
    { label: "One number", valid: /[0-9]/.test(password) },
  ];
}

export default function NewPasswordPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [validating, setValidating] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const checks = useMemo(() => getPasswordChecks(password), [password]);
  const passwordIsValid = checks.every((check) => check.valid);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  useEffect(() => {
    async function validateSession() {
      try {
        const res = await fetch("/api/auth/reset-password");
        setValidSession(res.ok);
      } finally {
        setValidating(false);
      }
    }
    validateSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!passwordIsValid) {
      setError("Password does not meet the minimum strength requirements.");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      addToast({
        title: "Password updated",
        description: "You can now sign in with your new password.",
        variant: "success",
      });
      router.push(data.redirectTo || "/login?reset=success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset password";
      setError(message);
      addToast({ title: "Reset failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <Card className="shadow-slate-950/16 overflow-hidden rounded-[1.75rem] border-white/80 bg-white/95 shadow-2xl ring-1 ring-slate-950/5 backdrop-blur">
        <CardContent className="flex items-center justify-center py-14">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (!validSession) {
    return (
      <Card className="shadow-slate-950/16 overflow-hidden rounded-[1.75rem] border-white/80 bg-white/95 shadow-2xl ring-1 ring-slate-950/5 backdrop-blur">
        <CardHeader className="items-center border-b border-slate-200/70 px-7 pb-6 pt-8 text-center sm:px-10">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl border border-red-100 bg-red-50 shadow-inner">
            <XCircle className="h-9 w-9 text-red-600" />
          </div>
          <CardTitle className="mt-4 text-3xl font-black tracking-tight text-slate-950">
            Reset session expired
          </CardTitle>
          <CardDescription className="max-w-sm text-sm font-medium text-slate-500">
            Please request a new verification code to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-7 py-7 sm:px-10">
          <Link href="/forgot-password">
            <Button
              variant="outline"
              className="h-14 w-full rounded-xl border-slate-300 bg-white text-base font-black shadow-sm"
            >
              Request new code
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-slate-950/16 overflow-hidden rounded-[1.75rem] border-white/80 bg-white/95 shadow-2xl ring-1 ring-slate-950/5 backdrop-blur">
      <CardHeader className="items-center border-b border-slate-200/70 px-7 pb-6 pt-8 text-center sm:px-10">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl border border-blue-100 bg-blue-50 shadow-inner">
          <Lock className="h-9 w-9 text-blue-600" />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
          Final step
        </p>
        <CardTitle className="text-3xl font-black tracking-tight text-slate-950">
          Create new password
        </CardTitle>
        <CardDescription className="max-w-sm text-sm font-medium text-slate-500">
          Choose a strong password for your Cloud Daftar account.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-7 py-7 sm:px-10">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="h-14 rounded-xl border-slate-300 text-base font-semibold shadow-sm"
            required
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="h-14 rounded-xl border-slate-300 text-base font-semibold shadow-sm"
            required
          />

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold">
            {checks.map((check) => (
              <div key={check.label} className="flex items-center gap-2">
                <CheckCircle2
                  className={`h-4 w-4 ${check.valid ? "text-green-600" : "text-muted-foreground"}`}
                />
                <span className={check.valid ? "text-foreground" : "text-muted-foreground"}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="h-14 w-full rounded-xl bg-blue-600 text-base font-black text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
            disabled={loading || !passwordIsValid || !passwordsMatch}
          >
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Reset password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
