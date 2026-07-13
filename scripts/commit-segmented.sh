#!/usr/bin/env bash
# Segment uncommitted work into reviewable commits with GPG signatures.
#
# Usage:
#   ./scripts/commit-segmented.sh           # create commits (-S / GPG sign)
#   ./scripts/commit-segmented.sh --dry-run # preview only
#   ./scripts/commit-segmented.sh --no-gpg  # plain git commit (no -S)
#
# Requires: clean intent to commit ALL listed changes; run from repo root.
# Recommended before push:
#   npm run lint && npm run typecheck && npm test

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DRY_RUN=0
GPG_SIGN=1

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-gpg) GPG_SIGN=0 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository." >&2
  exit 1
fi

if [[ -n "$(git diff --cached --name-only)" ]]; then
  echo "Staged changes already present. Commit or unstage them first." >&2
  exit 1
fi

commit_msg() {
  local title="$1"
  local body="${2:-}"
  if [[ -n "$body" ]]; then
    printf '%s\n\n%s' "$title" "$body"
  else
    printf '%s' "$title"
  fi
}

do_commit() {
  local title="$1"
  local body="${2:-}"
  shift 2
  local -a paths=("$@")

  if [[ ${#paths[@]} -eq 0 ]]; then
    echo "skip (no paths): $title" >&2
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo ""
    echo "=== COMMIT: $title ==="
    [[ -n "$body" ]] && echo "$body" | sed 's/^/    /'
    printf '    files:\n'
    for p in "${paths[@]}"; do
      printf '      %s\n' "$p"
    done
    return 0
  fi

  git add -- "${paths[@]}"
  if git diff --cached --quiet; then
    echo "skip empty: $title" >&2
    return 0
  fi

  local -a git_args=(commit)
  if [[ "$GPG_SIGN" -eq 1 ]]; then
    git_args+=(-S)
  fi

  if [[ -n "$body" ]]; then
    git "${git_args[@]}" -m "$title" -m "$body"
  else
    git "${git_args[@]}" -m "$title"
  fi
}

echo "Repository: $ROOT"
echo "Mode: $([[ "$DRY_RUN" -eq 1 ]] && echo dry-run || echo commit)"
echo "GPG:  $([[ "$GPG_SIGN" -eq 1 ]] && echo 'enabled (-S)' || echo disabled)"
echo ""

if [[ "$DRY_RUN" -eq 0 ]]; then
  read -r -p "Create 7 commits in order? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# 1 — shared domain types
do_commit \
  "feat(types): extend domain models for flags, reports, and geocoding" \
  "Add AdminFlagGroup, UserPlaceFlag, PlaceReportGroup, and geocode metadata fields used by moderation, account, and lookup flows." \
  types/domain.ts

# 2 — reputation backend
do_commit \
  "feat(reputation): automatic scoring and submission floor" \
  "Award or deduct reputation on report and flag lifecycle events. Block submissions below −10. Admins can override score via validation schema." \
  lib/reputation \
  server/services/reputation-service.ts \
  server/services/report-service.ts \
  server/services/moderation-service.ts \
  server/services/flag-service.ts \
  server/services/report-errors.ts \
  server/repositories/flag-repository.ts \
  server/repositories/report-repository.ts \
  server/validation/schemas.ts \
  app/api/places/\[id\]/reports/route.ts \
  app/api/places/\[id\]/flags/route.ts \
  config/constants.ts \
  lib/rate-limit/index.ts \
  __tests__/reputation-scoring.test.ts \
  __tests__/report-service-cache.test.ts

# 3 — account history
do_commit \
  "feat(account): 30-day report and flag history with active/archive views" \
  "User-facing lists, me/* APIs, Redis cache keys, and withdrawal rules for pending reports." \
  app/account/page.tsx \
  app/api/me/reports/route.ts \
  app/api/me/reports/\[id\]/route.ts \
  app/api/me/flags \
  components/account/account-dashboard.tsx \
  lib/account \
  lib/reports/user-report-state.ts \
  lib/flags/user-flag-state.ts \
  lib/cache/user-account-cache.ts \
  lib/cache/keys.ts \
  server/validation/user-reports-query.ts \
  server/validation/user-flags-query.ts \
  __tests__/user-report-state.test.ts \
  __tests__/user-flag-state.test.ts \
  __tests__/recent-list-window.test.ts \
  __tests__/cache-keys.test.ts

# 4 — admin flag groups
do_commit \
  "feat(admin): group open place flags by merchant" \
  "Moderation queue merges flags by place. Resolve/dismiss clears the whole group; reputation applies once per reporter." \
  lib/flags/admin-flag-groups.ts \
  app/api/admin/flags/route.ts \
  components/admin/admin-dashboard.tsx \
  lib/cache/admin-cache.ts \
  __tests__/admin-flag-groups.test.ts

# 5 — public report grouping
do_commit \
  "feat(places): group recent reports on place detail pages" \
  "API returns grouped multiplier/context summaries; UI shows unique reporter counts." \
  lib/reports/place-report-groups.ts \
  components/places/place-details.tsx \
  __tests__/place-report-groups.test.ts

# 6 — admin lookup + geocoding
do_commit \
  "feat(geocode): tiered merchant lookup and Mapbox Search Box POI" \
  "Admin place search (name/postal/address/UUID). Geocode tiers: postal, address, name+city. Search Box fills POI gaps; strict city filter." \
  lib/admin \
  app/api/admin/places/route.ts \
  server/repositories/place-repository.ts \
  components/admin/admin-place-detail.tsx \
  lib/geocoding/address-query.ts \
  lib/geocoding/client.ts \
  lib/geocoding/parse-result.ts \
  lib/geocoding/mapbox-feature.ts \
  lib/geocoding/mapbox-search.ts \
  lib/geocoding/mapbox-searchbox.ts \
  server/services/geocoding-service.ts \
  __tests__/address-query.test.ts \
  __tests__/geocode-parse-result.test.ts \
  __tests__/mapbox-feature.test.ts \
  __tests__/mapbox-search.test.ts \
  __tests__/mapbox-searchbox.test.ts \
  __tests__/place-search.test.ts \
  __tests__/canadian-postal-code.test.ts

# 7 — docs
do_commit \
  "docs: update README and ARCHITECTURE for flags, reputation, and geocoding" \
  "Document admin flag grouping, account history, tiered geocode lookup, and near-term roadmap." \
  README.md \
  ARCHITECTURE.md \
  scripts/commit-segmented.sh

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo ""
  echo "Dry run complete. Re-run without --dry-run to commit."
  exit 0
fi

remaining="$(git status --porcelain)"
if [[ -n "$remaining" ]]; then
  echo ""
  echo "Warning: uncommitted files remain:" >&2
  echo "$remaining" >&2
  exit 1
fi

echo ""
echo "Done. Recent commits:"
git log -7 --oneline
