import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Solo", short_name: "Solo", start_url: "/call", display: "standalone", background_color: "#1b2130", theme_color: "#1b2130" };
}
