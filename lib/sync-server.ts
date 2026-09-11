import type { AppData } from "./types";

export const SYNC_ROW_ID = "voltsense-inacap-2026";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://soeyyyipgubxmyedgxng.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvZXl5eWlwZ3VieG15ZWRneG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTIyMTcsImV4cCI6MjA5NDE4ODIxN30.NBJ8Exgvhk4tsroQp-X0C1Qj_YeJKRslYf4nVabsNio";

const TABLE = "voltsense_despacho";

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  };
}

function asAppData(value: unknown): AppData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as AppData;
  if (!Array.isArray(data.routes) || !Array.isArray(data.assignments)) {
    return null;
  }
  return data;
}

export async function readSharedState(): Promise<AppData | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(SYNC_ROW_ID)}&select=payload,updated_at`,
    {
      headers: headers({ Accept: "application/json" }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`sync read ${res.status}`);
  }
  const rows = (await res.json()) as {
    payload?: unknown;
    updated_at?: number;
  }[];
  const row = rows[0];
  const payload = asAppData(row?.payload);
  if (!payload) return null;
  return {
    ...payload,
    updatedAt: Math.max(payload.updatedAt ?? 0, row?.updated_at ?? 0),
  };
}

export async function writeSharedState(data: AppData): Promise<AppData> {
  const updatedAt = data.updatedAt ?? Date.now();
  const incoming = { ...data, updatedAt };
  const current = await readSharedState();
  if ((current?.updatedAt ?? 0) > updatedAt) return current as AppData;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: headers({
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify({
      id: SYNC_ROW_ID,
      payload: incoming,
      updated_at: updatedAt,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sync write ${res.status} ${text}`);
  }
  return incoming;
}
