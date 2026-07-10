# ── Dockerfile untuk Back4app (root repo level) ───────────────────────────────
# Repo structure: campusrelove/backend/server.js
FROM node:20-alpine

WORKDIR /app

# Copy package files dari subfolder backend
COPY campusrelove/backend/package.json campusrelove/backend/package-lock.json* ./

# Install production dependencies saja
RUN npm ci --only=production && npm cache clean --force

# Copy semua source backend
COPY campusrelove/backend/ .

# Non-root user untuk keamanan container
USER node

ENV PORT=8003
EXPOSE 8003

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health || exit 1

CMD ["node", "server.js"]
