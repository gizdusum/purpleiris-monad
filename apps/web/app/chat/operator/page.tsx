import type { Metadata } from "next";
import { OperatorChatClient } from "./OperatorChatClient";

export const metadata: Metadata = {
  title: "Operator",
};

export default function OperatorChatPage() {
  return <OperatorChatClient />;
}
