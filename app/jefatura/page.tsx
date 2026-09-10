import { JefaturaApp } from "@/components/JefaturaApp";
import { AuthGate } from "@/components/AuthGate";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return (
    <AuthGate roles={["jefatura", "admin"]}>
      <JefaturaApp initialTab={tab} />
    </AuthGate>
  );
}
