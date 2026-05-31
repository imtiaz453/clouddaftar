"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

const PermissionsContext = createContext<string[]>([]);

export function PermissionsProvider({
  children,
  permissions,
}: {
  children: ReactNode;
  permissions: string[];
}) {
  const value = useMemo(() => permissions, [permissions]);
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

export function useHasPermission(permission: string) {
  return usePermissions().includes(permission);
}
