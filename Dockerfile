# ==============================================
# Personal Finance Tracker - Docker Build
# Multi-stage build: Bun (build) -> Nginx (serve)
# ==============================================

# Stage 1: Build with Bun
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Add build-time arguments for environment variables
ARG VITE_NEON_DATABASE_URL
ARG VITE_USE_NEON
ARG VITE_GEMINI_API_KEY

# Set them as environment variables so Vite can pick them up during build
ENV VITE_NEON_DATABASE_URL=$VITE_NEON_DATABASE_URL
ENV VITE_USE_NEON=$VITE_USE_NEON
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY

# Copy package files first (for better layer caching)
COPY package.json bun.lock ./

# Install dependencies (production only for smaller image)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# ==============================================
# Stage 2: Serve with Nginx (production)
# ==============================================
# Use the official unprivileged Nginx image so the container can run as non-root
# and bind to an unprivileged port (we use 8080 in nginx.conf).
FROM nginxinc/nginx-unprivileged:alpine AS production

# Add labels for container identification
LABEL maintainer="Personal Finance Tracker"
LABEL version="1.0"
LABEL description="Personal Finance Tracker - React + Vite + Neon"

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Provide a tiny HTTP client for the healthcheck
USER root
RUN apk add --no-cache curl
USER 101

# Expose unprivileged port (matches nginx.conf)
EXPOSE 8080

# Health check (use the explicit /health endpoint)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS http://localhost:8080/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
