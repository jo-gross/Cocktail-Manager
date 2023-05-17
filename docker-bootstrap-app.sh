#!/bin/sh
# ENVIRONEMTN from docker-compose.yaml doesn't get through to subprocesses
# Need to explicit pass DATABASE_URL here, otherwise migration doesn't work
# Run migrations
DATABASE_URL="postgres://postgres:postgres@postgres:5432/cocktail_recipe?sslmode=disable" npx prisma migrate deploy
# start app
DATABASE_URL="postgres://postgres:postgres@postgres:5432/cocktail_recipe?sslmode=disable" node server.js
