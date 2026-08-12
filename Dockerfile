# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Config for the browser bundle. `.env` is excluded from the build context (see
# .dockerignore) so secrets never end up in an image layer — the values are
# passed in instead, and `scripts/generate-env.mjs` prefers the environment over
# any file. API_BASE_URL has no default: a build without it fails here rather
# than shipping a bundle whose requests resolve against the page URL.
#
#   docker build \
#     --build-arg API_BASE_URL=https://api.example.com \
#     --build-arg GOONG_MAPS_KEY=... \
#     --build-arg GOONG_PLACES_KEY=... .
#
# STRICT_ENV makes every key mandatory here, not just API_BASE_URL. Without it a
# missing secret builds a bundle whose map silently renders nothing — the kind
# of failure that reaches production and shows up as a bug report, not a red
# build. This is the image that gets deployed, so it is the right place to be
# strict; `npm start` and the PR build stay permissive.
ARG API_BASE_URL
ARG GOONG_MAPS_KEY
ARG GOONG_PLACES_KEY
ENV API_BASE_URL=$API_BASE_URL \
    GOONG_MAPS_KEY=$GOONG_MAPS_KEY \
    GOONG_PLACES_KEY=$GOONG_PLACES_KEY \
    STRICT_ENV=1

RUN npm run build -- --configuration production

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist/fuse/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
