import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./arcade.css";
import { campaign } from "@/config/campaign";
export const metadata: Metadata = {
  metadataBase: new URL(campaign.siteUrl),
  title: "Jaago Campus | Ahmed Malik for Vice President, GDGOC",
  description:
    "Play Campus Dash: collect votes, jump quiz hurdles and dodge deadlines across the E-9 campus. An instant-play arcade by Ahmed Malik, candidate for Vice President, GDGOC Air University.",
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
