#!/usr/bin/env bash
# Run from repo root. Commits are GPG-signed if commit.gpgsign is enabled.
#
# After this script, bump version and GPG-sign separately:
#   npm version minor --no-git-tag-version   # 1.0.1 -> 1.1.0
#   git add package.json && git commit -S -m "1.1.0"
set -euo pipefail

cd "$(dirname "$0")/.."

commit() {
  local msg="$1"
  shift
  git add "$@"
  git commit -m "$msg"
}

# 1. Supabase env refactor
commit "refactor(supabase): centralize publishable and secret key env helpers

Extract shared URL/key resolution so server, admin, and scripts use the same
validation and avoid duplicating legacy anon/service-role fallbacks." \
  lib/supabase/env.ts \
  lib/supabase/admin.ts \
  lib/supabase/client.ts \
  lib/supabase/server-client.ts \
  scripts/fix-imported-coordinates.ts \
  scripts/import-rewards-canada.ts \
  __tests__/supabase-env.test.ts

# 2. Database migrations
commit "feat(db): add auth hints, security status, and report moderation schema

Add migrations for account hints, user security fields, report review tracking,
and report_kind classification for moderation queue filtering." \
  supabase/migrations/20260712190000_auth_account_hints.sql \
  supabase/migrations/20260712200000_user_security_status.sql \
  supabase/migrations/20260712210000_report_moderation_review.sql \
  supabase/migrations/20260712220000_report_kind.sql

# 3. Redis cache layer
commit "fix(cache): add Redis admin cache with reliable version invalidation

Cache admin reads in Redis with version keys and TTL. Bump versions via write
client to avoid Upstash read-replica lag. Invalidate map and search caches on
place writes. Add jsonAdmin/jsonPublicCached response helpers." \
  lib/cache/admin-cache.ts \
  lib/cache/keys.ts \
  lib/cache/place-cache.ts \
  lib/cache/redis.ts \
  lib/api/response.ts \
  config/constants.ts \
  __tests__/cache-keys.test.ts

# 4. Moderation backend
commit "feat(moderation): report kinds, approve flow, and flag sync

Classify reports by kind, auto-approve confirm/update, add approve action,
sync flags with report status, and extend admin API validation." \
  lib/reports/report-kind.ts \
  types/domain.ts \
  server/repositories/flag-repository.ts \
  server/repositories/report-repository.ts \
  server/services/moderation-service.ts \
  server/services/report-service.ts \
  server/services/place-service.ts \
  server/validation/schemas.ts \
  components/places/place-details.tsx \
  __tests__/report-kind.test.ts

# 5. Cache HTTP headers on public APIs
commit "fix(cache): must-revalidate public map and search API responses

Replace 24-hour s-maxage with max-age=0 and must-revalidate so browsers and
CDNs revalidate after Redis invalidation instead of serving stale map data." \
  app/api/places/map/route.ts \
  app/api/places/\[id\]/route.ts \
  app/api/places/search/route.ts

# 6. Auth UX
commit "feat(auth): account hints, security settings, and password UX

Add account hints API, security settings panel, password strength/match UI,
email cooldown, OAuth provider icons, and auth email templates." \
  app/api/auth/account-hints/route.ts \
  server/services/auth-account-service.ts \
  components/auth/auth-method-list.tsx \
  components/auth/auth-provider-icon.tsx \
  components/auth/password-dots-input.tsx \
  components/auth/password-set-form.tsx \
  components/account/security-settings.tsx \
  components/ui/dialog.tsx \
  components/auth/auth-shell.tsx \
  components/auth/sign-in-form.tsx \
  components/auth/sign-up-form.tsx \
  lib/auth/account-hints-client.ts \
  lib/auth/email-cooldown.ts \
  lib/auth/password-match.ts \
  lib/auth/password-strength.ts \
  lib/auth/providers.ts \
  lib/auth/use-email-cooldown.ts \
  lib/auth/errors.ts \
  app/globals.css \
  supabase/templates/confirmation.html \
  supabase/templates/magic_link.html \
  supabase/templates/recovery.html \
  supabase/config.toml \
  __tests__/auth-providers.test.ts \
  __tests__/email-cooldown.test.ts \
  __tests__/password-match.test.ts \
  __tests__/password-strength.test.ts

# 7. Admin dashboard + no-store API responses
commit "feat(admin): moderation dashboard with search, hints, and live refetch

Replace admin page stub with full dashboard, paginated place search,
dismissible hints, staff badge, no-store admin API responses, and refetch
reports/flags after mod actions instead of stale optimistic state." \
  components/admin/admin-dashboard.tsx \
  components/admin/admin-place-detail.tsx \
  components/admin/places-pagination.tsx \
  app/admin/layout.tsx \
  app/admin/page.tsx \
  app/admin/places/\[id\]/page.tsx \
  app/api/admin/places/route.ts \
  app/api/admin/places/\[id\]/route.ts \
  app/api/admin/places/merge/route.ts \
  app/api/admin/session/route.ts \
  app/api/admin/users/route.ts \
  app/api/admin/users/\[id\]/route.ts \
  app/api/admin/flags/route.ts \
  app/api/admin/flags/\[id\]/route.ts \
  app/api/admin/reports/route.ts \
  app/api/admin/reports/\[id\]/route.ts \
  lib/api/admin-route-error.ts \
  lib/auth/role-label.ts \
  server/repositories/place-repository.ts \
  app/account/page.tsx \
  components/account/account-dashboard.tsx \
  components/layout/header.tsx

# 8. Pagination component
commit "feat(ui): shared viewport-aware pagination bar

Extract reusable pagination with dynamic page-number window based on viewport
width and compact mode for narrow sidebars." \
  components/ui/pagination-bar.tsx \
  lib/pagination/page-range.ts \
  __tests__/page-range.test.ts

# 9. Homepage
commit "feat(home): paginated list, responsive split, and mobile map fix

Add client-side places pagination, viewport-based map/list width split, fix
mobile map container height, bind dev server to LAN, bypass browser cache on
map fetches, and show tile load errors." \
  app/page.tsx \
  lib/layout/home-split.ts \
  lib/hooks/use-viewport-width.ts \
  components/map/merchant-map.tsx \
  next.config.ts \
  package.json

# 10. Submit flow & geocoding
commit "feat(submit): Canadian postal validation and address geocoding helpers

Validate postal codes, improve geocode query building, and refine merchant
submit location picker and geocoding service." \
  lib/geocoding/address-query.ts \
  lib/validation/canadian-postal-code.ts \
  components/reports/submit-page.tsx \
  components/map/location-picker.tsx \
  server/services/geocoding-service.ts \
  __tests__/address-query.test.ts \
  __tests__/canadian-postal-code.test.ts

# 11. Map animation
commit "feat(map): refine place animations and distance helpers

Improve fly/ease duration scaling, place entrance animation, and distance
sorting utilities with tests." \
  lib/map/distance.ts \
  lib/map/place-animation.ts \
  __tests__/place-animation.test.ts \
  __tests__/transition-duration.test.ts

# 12. Dev tooling & docs
commit "chore: env example updates, CI tweak, and release commit script

Document new env vars, ignore supabase .temp, align CI, and add staged
release-day-commits.sh for GPG-signed incremental commits." \
  .env.example \
  .github/workflows/ci.yml \
  .gitignore \
  app/layout.tsx \
  scripts/release-day-commits.sh

echo ""
echo "Done. Remaining unstaged changes (if any):"
git status --short
echo ""
echo "Next: bump minor version and GPG-sign the release commit:"
echo "  npm version minor --no-git-tag-version   # 1.0.1 -> 1.1.0"
echo "  git add package.json && git commit -S -m \"1.1.0\""
