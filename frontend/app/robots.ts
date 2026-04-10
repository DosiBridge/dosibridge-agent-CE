import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", // Protect internal APIs from being crawled
        "/auth/", // Login and auth flows should not be indexed
        "/dashboard/", // Private user areas should generally not be indexed
        "/monitoring/", // Monitoring is operational, not search content
      ],
    },
    sitemap: "https://agent.dosibridge.com/sitemap.xml",
  };
}
