import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dipdash Courier",
    short_name: "DL Courier",
    description: "Accept and deliver campus orders, and earn.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8faf9",
    theme_color: "#14532d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
