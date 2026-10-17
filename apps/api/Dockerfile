FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 3001
# Áp các migration trong prisma/migrations trước khi chạy.
# DB cũ đã tạo bằng db push: chạy một lần `npx prisma migrate resolve --applied 0_init`.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/seed.js && node dist/main.js"]
