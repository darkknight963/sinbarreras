FROM mcr.microsoft.com/playwright:v1.60.0-jammy
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
COPY package*.json ./
RUN npm install
RUN npx puppeteer browsers install chrome-headless-shell
COPY . .
CMD ["npx", "tsx", "src/index.ts"]
