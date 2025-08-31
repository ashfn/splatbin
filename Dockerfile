
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with better error handling and compatibility
RUN npm ci --omit=dev --no-audit --no-fund

# Create uploads directory
RUN mkdir -p uploads

COPY . .

RUN addgroup -g 1001 -S nodejs && \
    adduser -S splatbin -u 1001 -G nodejs

RUN chown -R splatbin:nodejs /app

USER splatbin

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
