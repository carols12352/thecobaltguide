# Contributing to The Cobalt Guide

Thank you for helping improve The Cobalt Guide. Contributions should be focused, reviewable, and safe for a public community project.

## Before you start

- Read and follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Search existing issues before opening a new one.
- Use the in-product **Report** action for a single merchant correction when possible. Use the merchant-data issue form when the product flow is unavailable or the problem affects many records.
- Report security vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Never publish exploit details, credentials, receipts, account information, or personal data in an issue.

## Local setup

1. Install Node.js 22 or later and npm.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and provide only the services needed for the workflow you are testing.
4. Run `npm run dev` for local development.

Database-backed work may require a local or disposable Supabase project. Follow [supabase/migrations/README.md](supabase/migrations/README.md) and never point destructive tests at production.

## Make a focused change

- Work from a dedicated branch.
- Keep unrelated refactors, formatting churn, generated artifacts, and dependency changes out of the pull request.
- Preserve the route → service → repository boundaries described in [ARCHITECTURE.md](ARCHITECTURE.md).
- Read the relevant Next.js 16 documentation in `node_modules/next/dist/docs/` before changing framework APIs or conventions.
- Add or update tests for behavior changes.
- Do not commit secrets, production data, private user information, local environment files, or unreviewed imported datasets.

## Verify the change

Run the checks relevant to your change. The standard local set is:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:architecture
```

UI and release-sensitive changes may also require:

```bash
npm run test:e2e
npm run test:lighthouse
```

Live RLS and integration tests require a migrated local or disposable Supabase environment:

```bash
npm run test:rls
npm run test:integration
```

If a check cannot run, explain why in the pull request rather than marking it as passed.

## Pull requests

- Link the issue the change addresses.
- Explain the user-visible outcome and important implementation decisions.
- Include screenshots for visual changes.
- State test results, migration impact, and security/privacy impact.
- Keep the pull request in draft while required work or evidence is missing.

By contributing, you agree that your contribution is licensed under the [GNU Affero General Public License v3.0](LICENSE).

## Licensing and third-party material

The AGPL-3.0 license covers original software contributions to this repository. It does not relicense third-party merchant data, map data or tiles, provider content, names, logos, or trademarks. Only contribute material you have the right to submit.
