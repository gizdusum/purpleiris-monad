import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    template: "%s · Purpleiris.live",
    default: "Purpleiris.live",
  },
  description:
    "PurpleIris — the open eye on Monad. On-chain validator intelligence: every number cited, every claim classified. Surfaces data, never advice.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://purpleiris.live"),
  openGraph: {
    title: "Purpleiris.live",
    description:
      "PurpleIris — the open eye on Monad. On-chain validator intelligence: every number cited, every claim classified. Surfaces data, never advice.",
    type: "website",
    url: "https://purpleiris.live",
  },
  twitter: {
    card: "summary_large_image",
    title: "Purpleiris.live",
    description:
      "PurpleIris — the open eye on Monad. On-chain validator intelligence: every number cited, every claim classified. Surfaces data, never advice.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetbrainsMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
