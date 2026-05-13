import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
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
      <body className={`${inter.variable} ${fraunces.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
