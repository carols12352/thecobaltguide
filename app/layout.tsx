import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "The Cobalt Guide",
    template: "%s | The Cobalt Guide",
  },
  description: "Find Cobalt merchant multipliers across Canada.",
  applicationName: "The Cobalt Guide",
  openGraph: {
    type: "website",
    siteName: "The Cobalt Guide",
    title: "The Cobalt Guide",
    description: "Find Cobalt merchant multipliers across Canada.",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Cobalt Guide",
    description: "Find Cobalt merchant multipliers across Canada.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Header />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <Footer />
        <SpeedInsights />
      </body>
    </html>
  );
}
