import type { Metadata, Viewport } from "next";
import { Mulish, Newsreader } from "next/font/google";
import "./globals.css";

const serif = Newsreader({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--serif" });
const sans = Mulish({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--sans" });

export const metadata: Metadata = { title: "Check-in", appleWebApp: { capable: true, title: "Check-in", statusBarStyle: "black-translucent" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#1b2130" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
