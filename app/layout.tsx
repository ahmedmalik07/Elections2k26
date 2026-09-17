import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./arcade.css";
import { campaign } from "@/config/campaign";
export const metadata: Metadata = {
  metadataBase: new URL(campaign.siteUrl),
  title: "Jaago Campus | Ahmed Malik for Vice President, GDGOC",
  description:
    "Play Campus Dash: dodge roadblocks, collect code tokens, and beat your best. An instant-play campus arcade by Ahmed Malik.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Jaago Campus",
    description: "Sab ne poster lagaye. Ahmed ne game bana diya.",
    images: ["/api/og"],
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1D2A5C",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
