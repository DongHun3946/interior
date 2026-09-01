FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_URL=
ARG VITE_NAVER_MAP_KEY_ID=
ARG VITE_ENABLE_SIMULATION=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_NAVER_MAP_KEY_ID=$VITE_NAVER_MAP_KEY_ID
ENV VITE_ENABLE_SIMULATION=$VITE_ENABLE_SIMULATION
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
