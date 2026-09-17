import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jaago Campus",
    short_name: "Jaago",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F4E9",
    theme_color: "#1D2A5C",
    orientation: "portrait",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
