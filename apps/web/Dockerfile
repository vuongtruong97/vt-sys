FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG API_INTERNAL_URL=http://api:3001
ARG NEXT_PUBLIC_WHITEBOARD_URL=ws://localhost:1234
ENV API_INTERNAL_URL=$API_INTERNAL_URL \
    NEXT_PUBLIC_WHITEBOARD_URL=$NEXT_PUBLIC_WHITEBOARD_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
