import type { Metadata } from "next";
import { ChatClient } from "./ChatClient";

export const metadata: Metadata = {
  title: "Delegator",
  description: "Ask about any Monad validator. Cited, classified, and never advisory.",
};

export default function DelegatorChatPage() {
  return <ChatClient />;
}
