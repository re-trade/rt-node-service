FROM node:22-alpine AS base
WORKDIR /rt-node
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    bash \
    curl
RUN adduser -D -h /home/retrade retrade

FROM node:22-alpine AS build
WORKDIR /build-node

RUN apk add --no-cache \
    openssl \
    libc6-compat \
    bash \
    curl

COPY . .
RUN yarn install --frozen-lockfile
RUN yarn prisma generate
RUN yarn build

FROM base AS final
WORKDIR /rt-node
USER retrade

COPY --chown=retrade:retrade --from=build /build-node/build ./build
COPY --chown=retrade:retrade --from=build /build-node/node_modules ./node_modules
COPY --chown=retrade:retrade --from=build /build-node/package.json ./
COPY --chown=retrade:retrade --from=build /build-node/prisma ./prisma

ENTRYPOINT ["sh", "-c", "yarn prisma migrate deploy && node ./build/index.js"]
