# Cocktail-Manager

## Getting started

Copy the `.env.example` file to `.env` and fill in the values.
To generate the Google OAuth credentials, go to
the [Google Developer Console](https://console.developers.google.com/apis/credentials) and create a OAuth 2.0-Client
with the following settings:

- Redirect URIs: http://localhost:3000/api/auth/callback/google

Start the database:

```bash
docker-compose up postgres -d
```

After [node](https://github.com/nodesource/distributions#installation-instructions) is installed, enable `corepack` to use `yarn`: [yarn](https://yarnpkg.com/getting-started/install)

```bash
sudo corepack enable
```

Install all dependencies:

```bash
yarn install
```

Before starting the application, you need to run the migrations (WARNING: this could drop all of your local data, pay
attention)

```bash
yarn migrate
```

Start the application:

```bash
yarn dev
```

## Docker

Build image

```bash
docker-compose -f docker-compose.yaml build
```

Push to local registry

```bash
docker push 10.200.16.1:8881/cocktails/cocktail-recipe-cocktails:latest
```
