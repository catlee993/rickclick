// Per-site rickroll config.
// signEndpoint = the gatekeeper worker's /sign route (e.g. https://media.yourdomain/sign).
// The clip itself lives in a PRIVATE R2 bucket and is only reachable via a
// short-lived signed URL the worker mints for allow-listed origins.
// deploy.sh can set signEndpoint from $SIGN_ENDPOINT across all sites.
// `video` is an optional direct-URL fallback for local dev only.
window.RICK_CONFIG = {
  brand: "TechWeekly",
  signEndpoint: "https://media.example.com/sign",
  revealAt: 0
};
