# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps flag (required for AI SDK)
RUN npm ci --legacy-peer-deps

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build argument for API base URL
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8085

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Build Next.js project (creates .next/standalone directory)
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build from builder
# The standalone output includes only necessary files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create scripts directory and copy the runtime config generation script
RUN mkdir -p ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/generate-runtime-config.js ./scripts/

# Ensure public directory is writable for runtime config generation
RUN chmod -R u+w ./public || true

# Create startup script that generates config and starts server
# Note: We create this as root, then chown it, since we switch users after
RUN echo '#!/bin/sh' > /tmp/start.sh && \
    echo 'node scripts/generate-runtime-config.js' >> /tmp/start.sh && \
    echo 'exec node server.js' >> /tmp/start.sh && \
    chmod +x /tmp/start.sh && \
    mv /tmp/start.sh /app/start.sh && \
    chown nextjs:nodejs /app/start.sh

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Start the server with config generation
CMD ["/app/start.sh"]
