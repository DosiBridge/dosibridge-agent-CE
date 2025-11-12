#!/usr/bin/env node
/**
 * Generate runtime configuration file from environment variables
 * This allows the API URL to be configured at container startup time
 */

const fs = require('fs');
const path = require('path');

// Get API base URL from environment variable, with fallback
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:8085';

// Create config object
const config = {
  API_BASE_URL: API_BASE_URL,
  // Add other runtime config here if needed
};

// Ensure public directory exists
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write config file to public directory
const configPath = path.join(publicDir, 'runtime-config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

console.log(`Runtime config generated: ${configPath}`);
console.log(`API_BASE_URL: ${API_BASE_URL}`);

