#!/usr/bin/env bash
# One-time media setup: PRIVATE R2 bucket + signing secret + gatekeeper worker.
# The bucket is never made public — the worker is the only reader, and it only
# hands out short-lived signed URLs to allow-listed origins.
#
# Uses its OWN bucket ("rickclick") and worker — separate from interestnaut.
# Prereqs: wrangler logged in (`npx wrangler login`).
set -euo pipefail

BUCKET="${R2_BUCKET:-rickclick}"
WRANGLER="${WRANGLER:-npx wrangler}"
VIDEO="latest-footage.mp4"

echo "==> Creating PRIVATE R2 bucket: $BUCKET (no-op if it exists)"
$WRANGLER r2 bucket create "$BUCKET" || true
echo "    (do NOT enable public access on this bucket)"

echo "==> Uploading $VIDEO to $BUCKET"
$WRANGLER r2 object put "$BUCKET/$VIDEO" --file "$VIDEO" --content-type "video/mp4"

echo "==> Setting the URL-signing secret on the worker"
if [ -n "${SIGNING_KEY:-}" ]; then
  ( cd worker && echo -n "$SIGNING_KEY" | $WRANGLER secret put SIGNING_KEY )
else
  echo "    SIGNING_KEY not set in env — set it interactively now:"
  echo "    (tip: generate one with  openssl rand -hex 32 )"
  ( cd worker && $WRANGLER secret put SIGNING_KEY )
fi

echo "==> Deploying gatekeeper worker (rickclick-media)"
( cd worker && $WRANGLER deploy )

cat <<'EOF'

==> Media is locked down. Last steps:
  1. Point a custom domain at the worker (Workers > rickclick-media > Settings >
     Domains & Routes), e.g. media.yourdomain.com — or note the *.workers.dev URL.
  2. Make sure worker/wrangler.jsonc ALLOWED_ORIGINS lists your real site origins,
     then redeploy the worker if you changed it.
  3. Wire the /sign endpoint into the sites and deploy them:
       SIGN_ENDPOINT="https://media.yourdomain.com/sign" ./deploy.sh

R2 egress is free; the worker adds a negligible amount of (also-free-tier) requests.
EOF
