FROM node:21 AS base
WORKDIR /sea-node
RUN useradd --create-home --shell /bin/bash vietnamsea

FROM node:21  AS build
WORKDIR /build-node
COPY . .
RUN yarn install --frozen-lockfile && yarn build

FROM base AS final
WORKDIR /sea-node
USER vietnamsea
COPY --chown=vietnamsea --from=build /build-node/build ./build
COPY --chown=vietnamsea --from=build /build-node/node_modules ./node_modules
COPY --chown=vietnamsea --from=build /build-node/package.json ./
ENTRYPOINT [ "node", "./build/index.js" ]