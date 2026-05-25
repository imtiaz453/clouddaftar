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
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!validSession) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-red-100 dark:bg-red-950">
            <XCircle className="h-6 w-6 text-red-600 dark:text-red-300" />
          </div>
          <CardTitle>Reset session expired</CardTitle>
          <CardDescription>Please request a new verification code to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/forgot-password">
            <Button variant="outline" className="w-full">
              Request new code
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Create new password</CardTitle>
        <CardDescription>Choose a strong password for your CloudDaftar account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
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

          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !passwordIsValid || !passwordsMatch}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
