import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LegacyResetPasswordPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-950">
          <AlertCircle className="h-6 w-6 text-amber-700 dark:text-amber-300" />
        </div>
        <CardTitle>Request a new code</CardTitle>
        <CardDescription>
          Password reset links have been replaced with secure verification codes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/forgot-password">
          <Button className="w-full">Send verification code</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
