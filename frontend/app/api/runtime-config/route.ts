/**
 * API route to serve runtime configuration
 * This allows the API URL to be configured at container startup time
 */

export async function GET() {
  // Read from environment variable (set at container startup)
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "http://localhost:8085";

  const config = {
    API_BASE_URL: apiBaseUrl,
  };

  return Response.json(config, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
