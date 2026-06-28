FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS builder
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc --project tsconfig.json

FROM mcr.microsoft.com/playwright:v1.60.0-jammy
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
RUN apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
RUN npx puppeteer browsers install chrome-headless-shell
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]