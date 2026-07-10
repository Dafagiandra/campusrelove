# ── Stage: production image ───────────────────────────────────────────────────
# Node 20 LTS Alpine — ringan dan aman
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies dulu (layer terpisah supaya di-cache Docker jika package.json tidak berubah)
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Copy semua source code (node_modules sudah ada dari langkah di atas)
COPY . .

# Jalankan sebagai non-root user untuk keamanan container
USER node

# Back4app akan inject PORT via env var, tapi default ke 8003
ENV PORT=8003
EXPOSE 8003

# Health check supaya platform tahu container sudah siap
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health || exit 1

# Start server
CMD ["node", "server.js"]
