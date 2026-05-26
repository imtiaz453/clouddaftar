"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Eye, EyeOff, Loader2, Building } from "lucide-react";
import { useToast } from "@/providers/toast-provider";

const LOGIN_UNAVAILABLE_MESSAGE =
  "We could not sign you in right now. Please try again in a moment or contact support if the issue continues.";

function getLoginErrorMessage(error?: string | null) {
  if (!error) return "";

  if (error === "CredentialsSignin" || error === "Invalid credentials") {
    return "The email or password you entered is incorrect.";
  }

  if (error === "Account is deactivated") {
    return "This account is currently inactive. Please contact your administrator.";
  }

  if (
    error.includes("prisma.") ||
    error.includes("database") ||
    error.includes("denied access") ||
    error.includes("ECONNREFUSED") ||
    error.includes("P1000")
  ) {
    return LOGIN_UNAVAILABLE_MESSAGE;
  }

  return error;
}

function LoginForm() {
  const { addToast } = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segments = (pathname ?? "").split("/").filter(Boolean);
  const tenant =
    segments.length === 2 && segments[1] === "login" ? segments[0] : searchParams?.get("tenant");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [branding, setBranding] = useState<{ logoUrl?: string; appName?: string }>({});
  const idleReason = searchParams?.get("reason") === "idle";

  useEffect(() => {
    if (tenant) {
      fetch(`/api/company/slug/${tenant}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success) {
            setBranding({ appName: d.data.name, logoUrl: d.data.logo });
          } else {
            fetch("/api/branding")
              .then((r) => r.json())
              .then((b) => {
                if (b.success) setBranding(b.data);
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    } else {
      fetch("/api/branding")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setBranding(d.data);
        })
        .catch(() => {});
    }
  }, [tenant]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (!result || result.error || !result.ok) {
        const message = getLoginErrorMessage(result?.error || LOGIN_UNAVAILABLE_MESSAGE);
        setError(message);
        addToast({ title: "Sign in unsuccessful", description: message, variant: "error" });
      } else {
        addToast({
          title: "Welcome back",
          description: "Signed in successfully.",
          variant: "success",
        });
        const callbackUrl = searchParams?.get("callbackUrl");
        const nextUrl =
          callbackUrl && callbackUrl.startsWith("/")
            ? callbackUrl
            : tenant
              ? `/${tenant}/apps`
              : "/apps";
        window.location.assign(nextUrl);
      }
    } catch {
      setError(LOGIN_UNAVAILABLE_MESSAGE);
      addToast({
        title: "Sign in unsuccessful",
        description: LOGIN_UNAVAILABLE_MESSAGE,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthSignIn(provider: string) {
    setLoading(true);
    try {
      await signIn(provider, { callbackUrl: tenant ? `/${tenant}/apps` : "/apps" });
    } catch {
      addToast({
        title: "Error",
        description: `Failed to sign in with ${provider}`,
        variant: "error",
      });
      setLoading(false);
    }
  }

  const hasGoogle = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const hasGitHub = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef3f8] px-5 py-10 text-slate-950">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(37,99,235,0.16),rgba(255,255,255,0)_44%),linear-gradient(180deg,rgba(255,255,255,0.9),rgba(226,232,240,0.94))]" />
      <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute left-0 top-0 h-24 w-full border-b border-white/70 bg-white/45" />

      <div className="relative z-10 w-full max-w-[520px]">
        <div className="shadow-slate-950/16 rounded-[1.75rem] border border-white/80 bg-white/95 p-7 shadow-2xl ring-1 ring-slate-950/5 backdrop-blur sm:p-10">
          <div className="mb-8 text-center">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.appName || "Cloud Daftar"}
                className="mx-auto h-24 w-24 object-contain"
              />
            ) : (
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-blue-100 bg-blue-50 shadow-inner">
                <Building className="h-12 w-12 text-blue-600" />
              </div>
            )}
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
              Secure workspace
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {branding.appName || "Cloud Daftar"}
            </h1>
            <p className="mt-2 text-base font-medium text-slate-500">
              Sign in to continue managing your business.
            </p>
          </div>

          {(hasGoogle || hasGitHub) && (
            <>
              <div className="mb-5 flex flex-col gap-3">
                {hasGoogle && (
                  <Button
                    variant="outline"
                    className="h-14 w-full border-slate-300 bg-white text-base font-bold text-slate-800 shadow-sm hover:bg-slate-50"
                    onClick={() => handleOAuthSignIn("google")}
                    disabled={loading}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Sign in with Google
                  </Button>
                )}
                {hasGitHub && (
                  <Button
                    variant="outline"
                    className="h-14 w-full border-slate-300 bg-white text-base font-bold text-slate-800 shadow-sm hover:bg-slate-50"
                    onClick={() => handleOAuthSignIn("github")}
                    disabled={loading}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    Sign in with GitHub
                  </Button>
                )}
              </div>
              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 font-bold text-slate-500">or continue with</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
                <div>
                  <p className="font-medium">Sign in unsuccessful</p>
                  <p className="mt-1 text-red-700 dark:text-red-200">{error}</p>
                </div>
              </div>
            )}
            {idleReason && !error && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                You were signed out automatically after 4 hours of inactivity.
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-base font-bold">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="h-14 rounded-xl border-slate-300 bg-white px-4 text-base font-semibold text-slate-950 shadow-sm placeholder:font-medium placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-4">
                <label htmlFor="password" className="text-base font-bold">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-bold text-blue-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  className="h-14 rounded-xl border-slate-300 bg-white px-4 pr-12 text-base font-semibold text-slate-950 shadow-sm placeholder:font-medium placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="h-14 w-full rounded-xl bg-blue-600 text-base font-black text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
              size="xl"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-base text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-bold text-blue-700 hover:underline">
              Sign up
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Copyright {new Date().getFullYear()} {branding.appName || "Cloud Daftar"}. All rights
          reserved.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
