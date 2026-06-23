#!/usr/bin/env bash
# Deploy all four sites to Cloudflare Pages (one project each).
#
# Usage:
#   SIGN_ENDPOINT="https://media.yourdomain.com/sign" ./deploy.sh
#   ./deploy.sh techweekly            # deploy a single site
#
# If SIGN_ENDPOINT is set, each site's config.js signEndpoint is rewritten to it
# before deploy. Run r2-setup.sh first to stand up the worker + private bucket.
#
# Prereqs: wrangler logged in (`npx wrangler login`).
set -euo pipefail

WRANGLER="${WRANGLER:-npx wrangler}"

# Pages project name per app dir. Edit project names to taste.
declare -A PROJECTS=(
  [allocator]="rickclick"
  [techweekly]="techweekly"
  [bizwiz]="bizwiz"
  [wirenow]="wirenow"
)

apply_sign_endpoint() {
  local dir="$1"
  [ -z "${SIGN_ENDPOINT:-}" ] && return 0
  [ -f "$dir/config.js" ] || return 0
  # Replace the signEndpoint: line with the real worker URL.
  sed -i.bak -E "s#(signEndpoint:[[:space:]]*\")[^\"]*(\")#\1${SIGN_ENDPOINT//#/\\#}\2#" "$dir/config.js"
  rm -f "$dir/config.js.bak"
  echo "    set signEndpoint -> $SIGN_ENDPOINT"
}

deploy_one() {
  local app="$1"
  local dir="apps/$app"
  local proj="${PROJECTS[$app]:-$app}"
  [ -d "$dir" ] || { echo "!! no such app: $app"; return 1; }
  echo "==> $app  ->  Pages project '$proj'"
  apply_sign_endpoint "$dir"
  $WRANGLER pages deploy "$dir" --project-name "$proj"
}

if [ $# -gt 0 ]; then
  for a in "$@"; do deploy_one "$a"; done
else
  for a in "${!PROJECTS[@]}"; do deploy_one "$a"; done
fi

cat <<'EOF'

==> Deployed. Final manual step (once per project, in the dashboard):
    Pages > <project> > Custom domains > add the matching domain:
      rickclick    -> your allocator domain
      techweekly   -> techweekly.xyz
      bizwiz       -> bizwiz.lol
      wirenow      -> wirenow.info
EOF
