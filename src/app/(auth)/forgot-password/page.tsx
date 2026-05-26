"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/providers/toast-provider";

const SUCCESS_MESSAGE = "If an account exists for this email, a verification code has been sent.";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to send verification code");
      }

      addToast({ title: "Check your email", description: SUCCESS_MESSAGE, variant: "success" });
      router.push(`/reset-password/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send verification code";
      setError(message);
      addToast({ title: "Request failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-slate-950/16 overflow-hidden rounded-[1.75rem] border-white/80 bg-white/95 shadow-2xl ring-1 ring-slate-950/5 backdrop-blur">
      <CardHeader className="items-center border-b border-slate-200/70 px-7 pb-6 pt-8 text-center sm:px-10">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl border border-blue-100 bg-blue-50 shadow-inner">
          <MailCheck className="h-9 w-9 text-blue-600" />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
          Password recovery
        </p>
        <CardTitle className="text-3xl font-black tracking-tight text-slate-950">
          Forgot password?
        </CardTitle>
        <CardDescription className="max-w-sm text-sm font-medium text-slate-500">
          Enter your email and we will send a 6-digit verification code.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-7 py-7 sm:px-10">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-14 rounded-xl border-slate-300 text-base font-semibold shadow-sm"
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
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Send verification code
          </Button>
        </form>
        <div className="mt-5 text-center text-sm font-bold">
          <Link href="/login" className="text-slate-500 hover:text-blue-700">
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Back to login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
