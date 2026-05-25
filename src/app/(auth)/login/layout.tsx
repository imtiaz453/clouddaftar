import { AuthThemeReset } from "@/components/shared/auth-theme-reset";

export const dynamic = "force-dynamic";

export default function LoginRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthThemeReset />
      {children}
    </>
  );
}
