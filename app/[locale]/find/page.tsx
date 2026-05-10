import type { Metadata } from "next";
import { getWatchtowerOverview } from "@/lib/monad/watchtower";
import { FindWizard } from "@/components/features/FindWizard";

export const metadata: Metadata = { title: "Find Your Validator" };
export const dynamic = "force-dynamic";

export default async function FindPage() {
  const overview = await getWatchtowerOverview().catch(() => null);
  return <FindWizard validators={overview?.validators ?? []} />;
}
