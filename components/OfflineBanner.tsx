"use client";

import { useEffect, useState } from "react";

export function useOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

export function OfflineBanner({ compact }: { compact?: boolean }) {
  const online = useOnline();
  if (online) return null;

  return (
    <p
      className={
        compact
          ? "rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950"
          : "mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950"
      }
      role="status"
    >
      Sin internet. La ficha sigue en este teléfono; Llegué, Me fui y las notas
      se guardan aquí y se actualizan apenas vuelva la señal.
    </p>
  );
}
