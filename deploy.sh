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

# App dirs and their Pages project names. (No associative arrays — macOS ships
# bash 3.2, which doesn't support them.)
APPS="allocator techweekly bizwiz wirenow"
proj_for() {
  case "$1" in
    allocator) echo "rickclick" ;;
    *)         echo "$1" ;;
  esac
}

apply_sign_endpoint() {
  local dir="$1"
  [ -z "${SIGN_ENDPOINT:-}" ] && return 0
  [ -f "$dir/config.js" ] || return 0
  # Replace the signEndpoint: line with the real worker URL.
  # Use | as the sed delimiter (URLs never contain it) and pass the value
  # verbatim — escaping # here trips a bash anchor quirk that corrupts the URL.
  sed -i.bak -E "s|(signEndpoint:[[:space:]]*\")[^\"]*(\")|\1${SIGN_ENDPOINT}\2|" "$dir/config.js"
  rm -f "$dir/config.js.bak"
  echo "    set signEndpoint -> $SIGN_ENDPOINT"
}

deploy_one() {
  local app="$1"
  local dir="apps/$app"
  local proj; proj="$(proj_for "$app")"
  [ -d "$dir" ] || { echo "!! no such app: $app"; return 1; }
  echo "==> $app  ->  Pages project '$proj'"
  apply_sign_endpoint "$dir"
  # Deploy from INSIDE the dir so wrangler picks up its functions/ middleware
  # (wrangler looks for functions/ relative to the cwd, not the asset path).
  ( cd "$dir" && $WRANGLER pages deploy . --project-name "$proj" --branch main --commit-dirty=true )
}

if [ $# -gt 0 ]; then
  for a in "$@"; do deploy_one "$a"; done
else
  for a in $APPS; do deploy_one "$a"; done
fi

cat <<'EOF'

==> Deployed. Final manual step (once per project, in the dashboard):
    Pages > <project> > Custom domains > add the matching domain:
      rickclick    -> your allocator domain
      techweekly   -> techweekly.xyz
      bizwiz       -> bizwiz.lol
      wirenow      -> wirenow.info
EOF
