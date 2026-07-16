#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if ! git diff --cached --quiet; then
  echo "Staged changes already exist; commit or unstage them first." >&2
  exit 1
fi

dry_run=false
if [[ "${1:-}" == "--dry-run" ]]; then
  dry_run=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--dry-run]" >&2
  exit 1
fi

if [[ -z "${GPG_TTY:-}" ]] && current_tty="$(tty 2>/dev/null)"; then
  export GPG_TTY="$current_tty"
fi

commit_segment() {
  local message="$1"
  shift

  if [[ "$dry_run" == true ]]; then
    local changed
    changed="$(git status --short -- "$@")"
    if [[ -n "$changed" ]]; then
      echo "$message"
      echo "$changed"
    fi
    return
  fi

  git add -A -- "$@"
  if ! git diff --cached --quiet; then
    git commit --quiet -S -m "$message"
  fi
}

commit_segment "feat(db): add atomic Rewards Canada seed replacement" \
  supabase/migrations/20260715130000_rewards_canada_coverage.sql \
  supabase/migrations/20260715140000_rewards_canada_atomic_replace.sql \
  supabase/migrations/20260715150000_rewards_canada_cascade_cleanup.sql

commit_segment "feat(seed): install reviewed Rewards Canada dataset" \
  lib/import/geocode.ts \
  lib/import/rewards-canada.ts \
  lib/import/rewards-canada-reviewed.ts \
  lib/cache/place-cache.ts \
  supabase/scripts/import-rewards-canada.ts \
  supabase/scripts/replace-rewards-canada-seed.ts \
  package.json

commit_segment "test(seed): verify Rewards Canada review rules" \
  __tests__/rewards-canada-import.test.ts \
  __tests__/rewards-canada-reviewed.test.ts \
  __tests__/place-cache-invalidation.test.ts

commit_segment "chore(seed): remove one-time import artifacts" \
  .gitignore \
  scripts/commit-segmented.sh

commit_segment "docs: document seed replacement architecture" \
  README.md \
  ARCHITECTURE.md \
  supabase/scripts/README.md \
  supabase/migrations/README.md

if [[ "$dry_run" == true ]]; then
  remaining="$(git status --short -- . \
    ':(exclude)supabase/migrations/20260715130000_rewards_canada_coverage.sql' \
    ':(exclude)supabase/migrations/20260715140000_rewards_canada_atomic_replace.sql' \
    ':(exclude)supabase/migrations/20260715150000_rewards_canada_cascade_cleanup.sql' \
    ':(exclude)supabase/migrations/README.md' \
    ':(exclude)lib/import/geocode.ts' \
    ':(exclude)lib/import/rewards-canada.ts' \
    ':(exclude)lib/import/rewards-canada-reviewed.ts' \
    ':(exclude)lib/cache/place-cache.ts' \
    ':(exclude)supabase/scripts/import-rewards-canada.ts' \
    ':(exclude)supabase/scripts/replace-rewards-canada-seed.ts' \
    ':(exclude)supabase/scripts/README.md' \
    ':(exclude)package.json' \
    ':(exclude)__tests__/rewards-canada-import.test.ts' \
    ':(exclude)__tests__/rewards-canada-reviewed.test.ts' \
    ':(exclude)__tests__/place-cache-invalidation.test.ts' \
    ':(exclude).gitignore' \
    ':(exclude)scripts/commit-segmented.sh' \
    ':(exclude)README.md' \
    ':(exclude)ARCHITECTURE.md')"
  if [[ -n "$remaining" ]]; then
    echo "chore: commit remaining changes"
    echo "$remaining"
  fi
else
  git add -A
  if ! git diff --cached --quiet; then
    git commit --quiet -S -m "chore: commit remaining changes"
  fi
fi
