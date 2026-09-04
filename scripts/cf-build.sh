#!/usr/bin/env bash
# Assemble what Cloudflare Pages serves for the hosted content admin.
#
# This deployment is the whole site *plus* admin/, sitting behind Cloudflare
# Access. The site files are here on purpose: the admin's preview pane loads
# shared/chrome.css, the per-flow stylesheets and the page assets from the same
# origin, so a deployment carrying only admin/ would preview every page unstyled.
#
# It is a private mirror for staff. The public site is unaffected -- that is
# still GitHub Pages, published by .github/workflows/publish-review-site.yml,
# which strips admin/ and functions/ before it pushes.
set -euo pipefail

# A dead editor must not reach this deployment either: the page would load,
# look right, and let nobody sign in. See scripts/check-admin.py.
python3 "$(dirname "$0")/check-admin.py" admin/index.html

OUT="${1:-dist}"
rm -rf "$OUT"
mkdir -p "$OUT"

# Everything the site is made of, plus the editor.
for path in index.html styles.css app.js assets shared workflows admin; do
  [ -e "$path" ] && cp -R "$path" "$OUT/"
done

# Repo plumbing that no deployment needs. functions/ is deliberately NOT copied:
# Cloudflare reads Pages Functions from the repository root, not from the build
# output, so copying it here would publish the source of the API routes as
# static files.
rm -rf "$OUT/.github" "$OUT/DEPLOY.md" "$OUT/ADMIN-HOSTING.md" "$OUT/scripts"
# Never ships. See the note in publish-review-site.yml.
rm -rf "$OUT/slack data for technical troubleshooting"

# No underscore-prefixed paths today, but this costs nothing.
touch "$OUT/.nojekyll"

# The same digest the public publish generates, so the two deployments serve the
# same thing. Before the credential scan below, so it is scanned too.
node "$(dirname "$0")/build-digest.mjs" "$OUT/digest"

# The Cloudflare mirror is Access-gated, so a leak here is less severe than on
# GitHub Pages -- but the same files go to both, and the only way this check is
# worth anything is if it is impossible to route around. Failing here means the
# mistake is caught locally, before the commit that would publish it.
python3 "$(dirname "$0")/check-secrets.py" "$OUT"

echo "Built $OUT:"
find "$OUT" -maxdepth 1 -mindepth 1 -exec basename {} \; | sort | sed 's/^/  /'
