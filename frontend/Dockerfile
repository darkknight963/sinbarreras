FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
EXPOSE 80
# API_UPSTREAM_URL: URL del servidor API accesible desde este contenedor.
# Docker Compose: http://api:3000 | Railway: URL privada del servicio API.
ENV API_UPSTREAM_URL=http://api:3000
CMD ["/bin/sh", "-c", "envsubst '${API_UPSTREAM_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
