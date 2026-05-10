import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "PurpleIris — Monad Validator Intelligence",
    template: "%s | PurpleIris",
  },
  description:
    "Smart staking decisions and validator growth intelligence for the Monad blockchain.",
  metadataBase: new URL("https://purpleiris.live"),
  openGraph: {
    siteName: "PurpleIris",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning className="dark h-full">
      <body className={`${inter.variable} ${fraunces.variable} flex min-h-full flex-col`}>
        {children}
      </body>
    </html>
  );
}
