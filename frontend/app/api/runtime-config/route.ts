/**
 * API route to serve runtime configuration
 * This allows the API URL to be configured at container startup time
 *
 * IMPORTANT: This route reads from environment variables set at container startup.
 * The environment variable from docker-compose.yml will be available here.
 */

export async function GET() {
  // Read from environment variable (set at container startup via docker-compose)
  // Both API_BASE_URL and NEXT_PUBLIC_API_BASE_URL should be set to the same value in compose-vps.yml
  // We use API_BASE_URL as primary since it's explicitly set for runtime config
  //
  // IMPORTANT: This is a server-side route, so it reads from process.env at runtime
  // The environment variables from docker-compose.yml are available here

  // Read from environment - both should be the same value from compose-vps.yml
  const apiBaseUrl =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8085";

  // Log for debugging
  console.log("[Runtime Config] Reading from environment:", {
    API_BASE_URL: process.env.API_BASE_URL || "not set",
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "not set",
    resolved: apiBaseUrl,
  });

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
