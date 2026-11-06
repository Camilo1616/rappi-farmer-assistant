# Frontend de la app J.Bell (React + Vite) servido con nginx. Railway pone la variable PORT.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# La dirección del backend se "hornea" al compilar: pásala como variable de build en Railway.
ARG VITE_API_URL
ARG VITE_APK_URL
ENV VITE_API_URL=$VITE_API_URL VITE_APK_URL=$VITE_APK_URL
RUN npm run build

FROM nginx:alpine
# nginx reemplaza ${PORT} en la plantilla al arrancar
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
