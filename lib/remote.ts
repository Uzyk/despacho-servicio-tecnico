import type { AppData } from "./types";

function asAppData(value: unknown): AppData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as AppData;
  if (!Array.isArray(data.routes) || !Array.isArray(data.assignments)) {
    return null;
  }
  return data;
}

export async function pullRemote(): Promise<AppData | null> {
  try {
    const res = await fetch("/api/sync", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: unknown };
    return asAppData(json.data);
  } catch {
    return null;
  }
}

let queued: AppData | null = null;
let sending = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function pushRemote(data: AppData) {
  queued = data;
  void flushRemote();
}

async function flushRemote() {
  if (sending) return;
  sending = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  try {
    while (queued) {
      const payload = queued;
      queued = null;
      try {
        const res = await fetch("/api/sync", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        if (!res.ok) {
          queued = queued ?? payload;
          break;
        }
      } catch {
        queued = queued ?? payload;
        break;
      }
    }
  } finally {
    sending = false;
    if (queued) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void flushRemote();
      }, 3000);
    }
  }
}
