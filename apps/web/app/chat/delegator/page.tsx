import type { Metadata } from "next";
import { ChatClient } from "./ChatClient";

export const metadata: Metadata = {
  title: "Iris — Delegator Mode",
  description: "Ask Iris about any Monad validator. Cited, classified, and never advisory.",
};

export default function DelegatorChatPage() {
  return <ChatClient />;
}
