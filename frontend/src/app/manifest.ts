import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ARES PATH",
    short_name: "ARES PATH",
    description: "Research prototype for explainable Marswalk route planning.",
    start_url: "/",
    display: "standalone",
  };
}
