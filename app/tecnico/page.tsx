import { TecnicoApp } from "@/components/TecnicoApp";
import { AuthGate } from "@/components/AuthGate";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return (
    <AuthGate roles={["tecnico"]}>
      <TecnicoApp initialTab={tab} />
    </AuthGate>
  );
}
