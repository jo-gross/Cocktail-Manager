# Contributing to Cocktail-Manager

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

Follow the [README](README.md) to set up the project locally. In short:

1. Clone the repository and copy `.env.example` to `.env`
2. Enable corepack (`sudo corepack enable`) to use pnpm
3. Start the database with `docker compose up postgres -d`
4. Install dependencies with `pnpm install`
5. Apply migrations with `pnpm prisma migrate deploy`
6. Start the dev server with `pnpm dev`

## Code Style

- **Prettier** and **ESLint** are configured for the project.
- Run `pnpm format:check` to verify formatting, or `pnpm format:fix` to auto-fix.
- Linting and formatting run automatically via pre-commit hooks, so in most cases you don't need to run them manually.

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Every commit message (and PR title) must follow this format:

```
<type>: <description>
```

Common types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `ci`.

## Pull Request Process

1. Fork the repository and create a feature branch from `main`.
2. Make your changes and ensure the build passes (`pnpm build`).
3. Verify formatting with `pnpm format:check`.
4. Open a pull request with a title following Conventional Commits.
5. Fill out the PR template — check off all applicable items.
6. A maintainer will review your PR. Please be patient and responsive to feedback.

## Reporting Issues

- Search [existing issues](https://github.com/jo-gross/cocktail-manager/issues) before opening a new one.
- Use the provided issue templates (bug report or feature request).
- Include as much context as possible: version, browser, steps to reproduce.

## Questions?

If you're unsure about anything, feel free to [start a discussion](https://github.com/jo-gross/cocktail-manager/discussions).
