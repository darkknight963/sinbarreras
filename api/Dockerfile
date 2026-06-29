FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
# Alpine OpenSSL por defecto usa SECLEVEL=2, que rechaza claves RSA < 2048 bits.
# Culqi usa RSA-1024; bajamos a SECLEVEL=1 para permitirla.
RUN printf '[system_default_sect]\nMinProtocol = TLSv1.2\nCipherString = DEFAULT@SECLEVEL=1\n' \
    >> /etc/ssl/openssl.cnf
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
