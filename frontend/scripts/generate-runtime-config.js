#!/usr/bin/env node
/**
 * Generate runtime configuration file from environment variables
 * This allows the API URL to be configured at container startup time
 */

const fs = require('fs');
const path = require('path');

// Get API base URL from environment variable, with fallback
// Both API_BASE_URL and NEXT_PUBLIC_API_BASE_URL should be set to the same value in compose-vps.yml
// Priority: API_BASE_URL > NEXT_PUBLIC_API_BASE_URL > default
const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8085';

// Create config object
const config = {
  API_BASE_URL: API_BASE_URL,
  // Add other runtime config here if needed
};

// Determine public directory path
// In standalone build, public is at /app/public
// Try multiple possible locations
let publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  // Try absolute path (standalone build)
  const altPath = '/app/public';
  if (fs.existsSync(altPath)) {
    publicDir = altPath;
    console.log(`Using alternate public directory: ${publicDir}`);
  } else {
    console.log(`Creating public directory: ${publicDir}`);
    fs.mkdirSync(publicDir, { recursive: true });
  }
} else {
  console.log(`Using public directory: ${publicDir}`);
}

// Write config file to public directory
const configPath = path.join(publicDir, 'runtime-config.json');
try {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`✓ Runtime config generated: ${configPath}`);
  console.log(`✓ API_BASE_URL: ${API_BASE_URL}`);
  
  // Verify the file was written
  if (fs.existsSync(configPath)) {
    const written = fs.readFileSync(configPath, 'utf8');
    console.log(`✓ Config file verified. Contents: ${written}`);
  } else {
    console.error(`✗ ERROR: Config file was not created at ${configPath}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`✗ ERROR: Failed to write config file:`, error);
  process.exit(1);
}

