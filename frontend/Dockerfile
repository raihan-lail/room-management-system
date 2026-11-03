FROM oven/bun:1.3.11 AS build

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

# Empty value keeps API and WebSocket requests on the same origin (served by nginx)
ARG VITE_API_BASE_URL=""

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN bun run build

FROM nginx:alpine AS release

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
