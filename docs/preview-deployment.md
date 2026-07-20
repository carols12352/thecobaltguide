# Preview deployment operations

Preview deployments are explicit, PR-scoped operations. Vercel native Git
deployments are disabled in `vercel.json`; the workflow on the default branch is
the only supported path.

## Deploy a pull request

On an open pull request, add this exact top-level conversation comment:

```text
/deploy
```

`/deploy` currently accepts no parameters. Text such as `/deploy preview`, an
inline review comment, or a comment from an unauthorized account does not start
a deployment.

The workflow:

1. accepts requests only from an `OWNER`, `MEMBER`, or `COLLABORATOR`;
2. verifies that the PR is open and its head branch belongs to this repository;
3. resolves and checks out the PR head SHA at request time;
4. creates a new Vercel Preview deployment without changing Production;
5. posts a start notice, then updates that notice with the Preview URL or a
   failure link.

Each accepted `/deploy` comment schedules a new deployment. A running deployment
is not cancelled by a later request; GitHub may replace an older pending run if
several requests queue for the same PR. Fork PRs are rejected so untrusted code
cannot receive Preview environment secrets.

The workflow definition must exist on `main` because GitHub evaluates
`issue_comment` workflows from the default branch. A workflow change made only
inside a PR cannot alter how that PR's comments are handled until the change is
present on `main`.

## Measure a preview

After deployment succeeds, run the performance baseline from the same PR:

```text
/performance <target_url> [samples]
```

| Parameter | Required | Default | Constraints |
| --- | --- | --- | --- |
| `target_url` | yes | — | Public HTTP(S) URL without embedded credentials |
| `samples` | no | `20` | Integer from 5 through 100 |

Example:

```text
/performance https://example-preview.vercel.app 30
```

`/performance-baseline <target_url> [samples]` remains an alias. The normal
samples measure CDN behavior. A separate origin probe sends `Pragma: no-cache`
and `Cache-Control: no-cache`; interpret its `Server-Timing` only when
`x-vercel-cache` is `MISS` or `REVALIDATED`.

Protected generated Vercel URLs can use the automation bypass secret. The
workflow sends that secret only when the hostname matches this project's
configured Vercel Preview namespace.

## Required repository configuration

The `preview` GitHub environment must expose:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Performance measurements of protected previews additionally use the repository
secret `VERCEL_AUTOMATION_BYPASS_SECRET`.

The workflow token needs `contents: read`, `issues: write`, and
`pull-requests: write` so it can resolve the PR and update its deployment notice.

## Troubleshooting

- Workflow skipped: confirm the comment is exactly `/deploy`, is on the PR
  conversation, and was posted by an authorized repository account.
- `Resource not accessible by integration`: confirm `pull-requests: write` is
  present in workflow permissions.
- Deployment never starts: inspect the start-notice step first; checkout and
  Vercel steps are skipped after an earlier failure.
- Baseline shows `Server-Timing` as `—`: a normal CDN `HIT` does not invoke the
  application. Check the separate origin probe status and deployed route
  instrumentation.
