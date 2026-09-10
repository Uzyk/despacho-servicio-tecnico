import { JefaturaApp } from "@/components/JefaturaApp";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <JefaturaApp initialTab={tab} />;
}
