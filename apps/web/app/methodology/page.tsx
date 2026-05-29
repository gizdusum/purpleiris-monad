import type { Metadata } from "next";
import MethodologyContent from "@/components/MethodologyContent";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How PurpleIris sources and classifies Monad validator data — data classes, formulas, tools, and pipeline transparency.",
};

export default function MethodologyPage() {
  return <MethodologyContent />;
}
