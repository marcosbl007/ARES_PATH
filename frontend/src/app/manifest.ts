import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/ares-path",
    name: "ARES PATH",
    short_name: "ARES PATH",
    description: "Research prototype for explainable Marswalk route planning.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "landscape",
    prefer_related_applications: false,
    theme_color: "#06101c",
    background_color: "#02070d",
    icons: [
      {
        src: "/brand/ares-path-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/ares-path-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
