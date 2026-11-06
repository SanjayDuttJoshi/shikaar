import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Special_Elite } from "next/font/google";
import "./globals.css";

const DISPLAY = Special_Elite({ variable: "--font-special", subsets: ["latin"], weight: ["400"] });
const BODY = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "SHIKAAR — Andhere mein koi hai",
  description: "Free co-op horror in your browser. Find the keys, restore the power, escape before the Shikari finds you.",
};

export const viewport: Viewport = {
  themeColor: "#050404",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html lang="en" className={`${DISPLAY.variable} ${BODY.variable} h-full antialiased`}>
    <body className="min-h-full bg-night text-bone">{children}</body>
  </html>
);

export default RootLayout;
