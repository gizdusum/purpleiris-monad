import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | PurpleIris",
    default: "PurpleIris — Monad Validator Intelligence",
  },
  description:
    "Iris — the open eye on Monad. AI-powered validator intelligence for staking decisions and network operations.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://purpleiris.live"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetbrainsMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
