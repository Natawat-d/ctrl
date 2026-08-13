FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
# bcryptjs is bundled into Next's server output, so it is absent from the
# standalone node_modules — copy it back for scripts/seed.mjs (pure-JS, zero-dep).
COPY --from=build /app/node_modules/bcryptjs ./node_modules/bcryptjs
EXPOSE 3000
CMD ["node", "server.js"]
