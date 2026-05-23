import type { Metadata } from "next";
import dynamic from "next/dynamic";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Hermes sources and classifies Monad validator data — data classes, formulas, tools, and pipeline transparency.",
};

const MethodologyContent = dynamic(() => import("@/components/MethodologyContent"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)" }} />,
});

export default function MethodologyPage() {
  return <MethodologyContent />;
}
