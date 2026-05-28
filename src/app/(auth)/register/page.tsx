"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/providers/toast-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
    country: "PK",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast({ title: "Registration failed", description: data.error, variant: "error" });
        return;
      }

      addToast({
        title: "Account created",
        description: "Opening your workspace",
        variant: "success",
      });
      const login = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (login?.error) {
        router.push("/login");
        return;
      }
      window.location.assign(data.companySlug ? `/${data.companySlug}/apps` : "/apps");
    } catch {
      addToast({ title: "Error", description: "Something went wrong", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-slate-950/16 overflow-hidden rounded-[1.75rem] border-white/80 bg-white/95 shadow-2xl ring-1 ring-slate-950/5 backdrop-blur">
      <CardHeader className="items-center border-b border-slate-200/70 px-7 pb-6 pt-8 text-center sm:px-10">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl border border-blue-100 bg-blue-50 shadow-inner">
          <Building className="h-9 w-9 text-blue-600" />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
          New workspace
        </p>
        <CardTitle className="text-3xl font-black tracking-tight text-slate-950">
          Create your account
        </CardTitle>
        <p className="max-w-sm text-sm font-medium text-slate-500">
          Set up the owner login and first company profile in one step.
        </p>
      </CardHeader>
      <CardContent className="px-7 py-7 sm:px-10">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Your Name"
            placeholder="John Ahmed"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-14 rounded-xl border-slate-300 text-base font-semibold shadow-sm"
            required
          />
          <Input
            label="Company / Business Name"
            placeholder="Ahmed Pharmacy"
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            className="h-14 rounded-xl border-slate-300 text-base font-semibold shadow-sm"
            required
          />
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-900">Locality</label>
            <Select value={form.country} onValueChange={(country) => setForm({ ...form, country })}>
              <SelectTrigger className="h-14 rounded-xl border-slate-300 bg-white text-base font-semibold shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PK">Pakistan</SelectItem>
                <SelectItem value="SA">Saudi Arabia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            label="Email"
            type="email"
            placeholder="john@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="h-14 rounded-xl border-slate-300 text-base font-semibold shadow-sm"
            required
          />
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="h-14 rounded-xl border-slate-300 pr-12 text-base font-semibold shadow-sm"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[35px] flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
            <CheckCircle2 className="mr-2 inline h-4 w-4 text-blue-600" />
            You can finish tax, logo, and numbering settings after sign up.
          </div>
          <Button
            type="submit"
            className="h-14 w-full rounded-xl bg-blue-600 text-base font-black text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
            size="xl"
            disabled={loading}
          >
            {loading && <LoadingSpinner size={5} className="mr-2" />}
            {loading ? "Creating account..." : "Create workspace"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-blue-700 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
