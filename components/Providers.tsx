"use client";

import { StoreProvider } from "@/lib/store";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <ServiceWorkerRegister />
      {children}
    </StoreProvider>
  );
}
