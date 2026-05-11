import type { Metadata } from "next";
import { OperatorClient } from "@/components/features/OperatorPanel";

export const metadata: Metadata = {
  title: "Operator Panel | PurpleIris",
  description: "Claim and manage your validator profile on PurpleIris.",
};

export default function OperatorPage() {
  return <OperatorClient />;
}
