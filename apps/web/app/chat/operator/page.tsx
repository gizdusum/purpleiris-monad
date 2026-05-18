import type { Metadata } from "next";
import { OperatorChatClient } from "./OperatorChatClient";

export const metadata: Metadata = {
  title: "Iris — Operator Mode · PurpleIris",
};

export default function OperatorChatPage() {
  return <OperatorChatClient />;
}
