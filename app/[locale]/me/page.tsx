import type { Metadata } from "next";
import { PersonalStakeClient } from "@/components/features/PersonalStake";

export const metadata: Metadata = {
  title: "My Stake Score | PurpleIris",
  description:
    "Connect your wallet to see your Monad delegation diversity score and get personalized recommendations.",
};

export default function MePage() {
  return <PersonalStakeClient />;
}
