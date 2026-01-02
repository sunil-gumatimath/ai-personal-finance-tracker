# ==============================================
# Personal Finance Tracker - Docker Build
# Multi-stage build: Bun (build) -> Nginx (serve)
# ==============================================

# Stage 1: Build with Bun
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Add build-time arguments for environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GEMINI_API_KEY

# Set them as environment variables so Vite can pick them up during build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
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
FROM nginx:alpine AS production

# Add labels for container identification
LABEL maintainer="Personal Finance Tracker"
LABEL version="1.0"
LABEL description="Personal Finance Tracker - React + Vite + Supabase"

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid

# Use non-root user (optional - comment out if causes permission issues)
# USER appuser

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
