import { Suspense } from "react";
import { JoinForm } from "@/components/JoinForm";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-stone-600">Cargando…</p>}>
      <JoinForm />
    </Suspense>
  );
}
