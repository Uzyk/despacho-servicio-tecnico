"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@/lib/auth";
import { useStore } from "@/lib/store";
import type { AccountRole } from "@/lib/types";

export function AuthGate({
  roles,
  children,
}: {
  roles: AccountRole[];
  children: ReactNode;
}) {
  const { account, ready } = useStore();
  const router = useRouter();
  const allowed = roles.join(",");

  useEffect(() => {
    if (!ready) return;
    if (!account) {
      router.replace("/");
      return;
    }
    if (!roles.includes(account.role)) {
      router.replace(ROLE_HOME[account.role]);
    }
  }, [ready, account, allowed, router, roles]);

  if (!ready) {
    return <p className="p-8 text-stone-600">Cargando…</p>;
  }
  if (!account || !roles.includes(account.role)) return null;
  return <>{children}</>;
}
