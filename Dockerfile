FROM mcr.microsoft.com/playwright:v1.43.0-jammy AS dependencies

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn

RUN yarn playwright install --with-deps chromium

FROM node:21-alpine AS build

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN yarn prisma generate
RUN yarn build

FROM node:21-alpine AS deploy

WORKDIR /app

ENV NODE_ENV production

RUN yarn add sharp
RUN yarn add prisma

COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY schema.prisma ./prisma/schema.prisma
COPY migrations ./prisma/migrations

EXPOSE 3000
ENV PORT 3000

CMD ["/bin/sh", "-c","yarn prisma migrate deploy;node server.js"]
