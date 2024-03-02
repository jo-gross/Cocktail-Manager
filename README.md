<p align="center">
  <img src="https://raw.githubusercontent.com/jo-gross/Cocktail-Manager/main/public/images/The%20Cocktail%20Manager%20Logo.png" width="120">
</p>
<h1 align="center">Cocktail-Manager</h1>
<p align="center">
  <em>an efficient tool for easily documenting, managing and accessing cocktail recipes behind your bar. </em>
</p>
<p align="center">
  <a href="https://github.com/jo-gross/cocktail-manager/releases/latest" rel="noopener noreferrer">
    <img src="https://img.shields.io/github/v/release/jo-gross/cocktail-manager" >
  </a>
  <a href="https://github.com/jo-gross/cocktail-manager/actions" target="_blank" rel="noopener noreferrer">
    <img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/jo-gross/cocktail-manager/semantic-release.yml">
  </a>
</p>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>

- [📍 Overview](#-overview)
- [🧩 Features](#-features)
- [🚀 Getting Started](#-getting-started)
  - [🐳 Docker](#-docker)
  - [⚙️ Local development](#-local-development)
- [📒 Changelog](#-changelog)
- [🤝 Contributing & Support](#-contributing--support)
- [📄 License](#-license)
- [🤗 Acknowledgments](#-acknowledgments)

</details>

---

## 📍 Overview

The Cocktail-Manager is a web application for managing cocktail recipes and ingredients. It is designed to be used in a
bar with several users, with different roles and permissions.
Originally a main goal was to create a compact view with all relevant infos from a high detailed cocktail recipes. Step
by step the application grew and now it is a full-featured cocktail management tool. It combines the background
management like financial/price calculation overview for partys or events, as well as the total production price of a
cocktail, with the detailed recipe making and the compact view for the bar tenders during the evening.

---

## 🧩 Features

- **Multiple seperated Bars** - You can manage multiple bars with different recipes and users without sharing data
  between them.
- **User management** - Invite and manage users with different roles
- **Cocktail recipe management** - Add, edit and delete cocktail recipes - in very detailed form.
- **Optimal and optimized for bar tenders** - Option for easy search and compact view with the necessary steps for an
  cocktail
- **Party/Event appraisal** - Calculate the amount of ingredients for a specific event or party, based on the cocktails
  you want to serve
- **Financial and statistics** - See the costs of your cocktails and create statistics of the shaked cocktails easily
- **Ingredient importer** - Ingredients from some websites (like conalco.de or rumundco.de) can be imported with a
  single click

---

## 🚀 Getting Started

**System Requirements:**

- Docker
- Google Cloud Project (for authentication)
- Node.js (only for local development)

**Google Client ID and Secret:**

To generate the Google OAuth credentials, go to
the [Google Developer Console](https://console.developers.google.com/apis/credentials) and create a OAuth 2.0-Client
with the following settings:

- Redirect URIs: http://localhost:3000/api/auth/callback/google

> Getting started with cloning the repository and copy the .env.example to .env
> ```sh
> git clone https://github.com/jo-gross/Cocktail-Manager.git
> cd Cocktail-Manager
> cp .env.example .env
> ```
> Enter your Google Client ID and Secret in the .env file and set the other environment variables.

When the application is running, you should be able to access it at [http://localhost:3000](http://localhost:3000)

---

### 🐳 Docker

You may have to login to Github Package Regirty first with `docker login ghcr.io` and a personal access token
with `read:packages` scope

#### Using `docker-compose`

> ![docker-compose](https://img.shields.io/badge/Docker-2496ED.svg?style=flat&logo=Docker&logoColor=white)
> ```sh
> docker-compose up -d
> ```

#### Using `locally build`

> ![docker-compose](https://img.shields.io/badge/Docker-2496ED.svg?style=flat&logo=Docker&logoColor=white)
> ```sh
> docker-compose up -d --build
> ```


---

### ⚙️ Local development

One-time setup:
> Enable `corepack` to use [`yarn`](https://yarnpkg.com/getting-started/install)
> ```sh
> sudo corepack enable
> ```

Starting development:
> Start the database
> ```sh
> docker-compose up postgres -d
> ```
> Install all dependencies
> ```sh
> yarn install
> ```
> Apply migrations (WARNING: this could drop all of your local data, pay attention)
> ```sh
> yarn prisma migrate dev
> ```
> Start the application
> ```sh
> yarn dev
> ```
> All ui changes are automatically reloaded, but you need to restart the server when changing the api

Developing changes that include database schema changes:
> Push your changes without creating a migration
> ```sh
> yarn prisma db push
> ```
>
> When you are done with your changes, create a migration
> ```sh
> yarn prisma migrate dev
> ```
>All other help can be found in the [Prisma Documentation](https://www.prisma.io/docs/orm/prisma-migrate)


---

## 📒 Changelog

All changes to the project are documented in
the [Changelog](https://github.com/jo-gross/Cocktail-Manager/blob/main/docs/CHANGELOG.md), automatically generated by
when creating a new release.

---

## 🤝 Contributing & Support

To grow the project, we need your help! See the links below to get started.

- [🔰 Contributing Guide][1]
- [👋 Start a Discussion][2]
- [🐛 Open an Issue][3]

[1]: https://github.com/jo-gross/cocktail-manager/blob/main/CONTRIBUTING.md "🔰 Contributing Guide"

[2]: https://github.com/jo-gross/cocktail-manager/discussions "👋 Start a Discussion"

[3]: https://github.com/jo-gross/cocktail-manager/issues "🐛 Open an Issue"

<p align="left">
  <a href="https://github.com/jo-gross/cocktail-manager/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=jo-gross/cocktail-manager" />
  </a>
</p>

As some asked, you´re also welcome to support financial to reduce costs, like hosting and domain fees, by donating.
Thank you for your support!

<p align='center'>
  <a href="https://www.buymeacoffee.com/jogross" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee"></a>
</p>

---

## 📄 License

This project is licensed under
the [GNU AGPL v3 license with a Common Clause v1.0 selling exception](https://github.com/jo-gross/cocktail-manager/blob/main/LICENSE).

---

## 🤗 Acknowledgments

- [Shields.io](https://shields.io/) - badges for your projects
- [contrib.rocks](https://contrib.rocks) - A tool to visualize GitHub contributors
- [saadeghi/daisyui](https://github.com/saadeghi/daisyui) - An awesome component library for Tailwind CSS
- [TandoorRecipes/recipes](https://github.com/TandoorRecipes/recipes) - Nice recipe book and a huge inspiration for the
  licence and a possible payment model
- [eli64s/readme-ai](https://github.com/eli64s/readme-ai/) - Inspiration for the README.md
- [medium.com/@brandonlostboy](https://medium.com/@brandonlostboy/build-it-better-next-js-api-handler-75070dd1826f) -
  Inspiration for
  the API-Handling middleware

<p align="right">
  <a href="#-overview"><b>Return</b></a>
</p>

---
