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
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Forgot password?</CardTitle>
        <CardDescription>
          Enter your email and we will send a 6-digit verification code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send verification code
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Back to login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
