/**
 * Runtime Config Loader
 * Preloads the API base URL from runtime config before the app makes any API calls
 */

"use client";

import { getApiBaseUrl } from "@/lib/api/client";
import { useEffect, useState } from "react";

export default function RuntimeConfigLoader() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [apiUrl, setApiUrl] = useState<string | null>(null);

  useEffect(() => {
    // Preload the API base URL as soon as the component mounts
    getApiBaseUrl()
      .then((url) => {
        setApiUrl(url);
        setIsLoaded(true);
        console.log("✓ Runtime config preloaded. API URL:", url);
      })
      .catch((error) => {
        console.error("✗ Failed to preload runtime config:", error);
        setIsLoaded(true); // Still allow app to continue
      });
  }, []);

  // This component doesn't render anything, it just preloads the config
  return null;
}
