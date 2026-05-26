import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LegacyResetPasswordPage() {
  return (
    <Card className="shadow-slate-950/16 overflow-hidden rounded-[1.75rem] border-white/80 bg-white/95 shadow-2xl ring-1 ring-slate-950/5 backdrop-blur">
      <CardHeader className="items-center border-b border-slate-200/70 px-7 pb-6 pt-8 text-center sm:px-10">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl border border-amber-100 bg-amber-50 shadow-inner">
          <AlertCircle className="h-9 w-9 text-amber-700" />
        </div>
        <CardTitle className="mt-4 text-3xl font-black tracking-tight text-slate-950">
          Request a new code
        </CardTitle>
        <CardDescription className="max-w-sm text-sm font-medium text-slate-500">
          Password reset links have been replaced with secure verification codes.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-7 py-7 sm:px-10">
        <Link href="/forgot-password">
          <Button className="h-14 w-full rounded-xl bg-blue-600 text-base font-black text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700">
            Send verification code
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
