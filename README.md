# rickclick

A link allocator + a set of believable themed landing pages that rickroll the
clicker. Hosted on Cloudflare (Pages for the sites, R2 for the video).

## Layout

```
apps/
  allocator/   click-a-rick link generator (copies a themed URL to clipboard)
  techweekly/  techweekly.xyz  — fake tech-news article  + cookie wall -> rickroll
  bizwiz/      bizwiz.lol       — fake business article   + cookie wall -> rickroll
  wirenow/     wirenow.info     — fake breaking-news story + cookie wall -> rickroll
shared/        canonical rickroll.js / rickroll.css / article.css (copied into each site)
worker/        gatekeeper worker: private R2 + signed, origin-locked streaming
latest-footage.mp4   the clip (lives in a PRIVATE R2 bucket in prod; gitignored)
r2-setup.sh    create the private bucket, set the signing secret, deploy the worker
deploy.sh      deploy every site to Pages
```

## How the video is locked down

The clip is **not** in a public bucket. Bucket `rickclick` is private; the
`worker/` gatekeeper is its only reader:

- `GET /sign` — if the caller's Origin/Referer is in the worker's `ALLOWED_ORIGINS`
  allowlist, returns a short-lived (120s) **HMAC-signed** URL for the clip.
- `GET /v/<key>?exp=&sig=` — verifies the signature + expiry, then streams the
  bytes with HTTP Range support (for seeking to `revealAt`). No valid token, no bytes.

So the video is signed (expiring, tamper-proof URLs) **and** only obtainable from
your four sites. The sites pre-fetch and refresh a token so the consent click can
start unmuted playback immediately. Signing secret lives as a worker secret
(`wrangler secret put SIGNING_KEY`), never in the repo.

## How the landing sites work

1. The allocator generates a URL like `https://techweekly.xyz/the-future-of-cloud-deploy-seamlessly`.
2. A Pages `_redirects` rule (`/* /index.html 200`) serves the article for **any** path.
3. `rickroll.js` de-slugifies the path into the headline — so the link you paste
   *is* the article title.
4. A GDPR-style cookie banner covers the article. **Any** button (Accept / Reject /
   Manage) fires the rickroll — the click is the user gesture that lets the video
   autoplay with sound, fullscreen, looping.

Tune per site in `apps/<site>/config.js` (`brand`, `video`, `revealAt`).

## Deploy

```bash
npx wrangler login
( cd worker && npm install )   # one-time, for wrangler + worker types

# 1. Private bucket + signing secret + gatekeeper worker (separate from interestnaut).
#    Generate a key first if you like:  export SIGNING_KEY=$(openssl rand -hex 32)
./r2-setup.sh
# then point a custom domain at the worker (e.g. media.yourdomain.com)

# 2. Deploy all four sites, wiring the worker's /sign endpoint into them
SIGN_ENDPOINT="https://media.yourdomain.com/sign" ./deploy.sh

# then add custom domains per Pages project in the Cloudflare dashboard
```

Make sure `worker/wrangler.jsonc` `ALLOWED_ORIGINS` lists your real site origins.

Cost: Pages (free, unlimited bandwidth) + R2 (free tier, zero egress) + Workers
(free tier, 100k req/day — a rickroll won't dent it). Only real spend is domains.

## Regenerating the clip

```bash
# 1. grab the source (the one true rickroll)
yt-dlp -f "bv*[height<=480]+ba/b[height<=480]" --merge-output-format mp4 \
  -o rr-raw.mp4 "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# 2. compress to a small, fast-starting 360p H.264 file
ffmpeg -y -i rr-raw.mp4 \
  -vf "scale=-2:360" -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 96k -movflags +faststart latest-footage.mp4
```

`-movflags +faststart` puts the moov atom up front so playback starts instantly.
`revealAt: 0` in each `config.js` means it opens on the intro.

## Local preview

```bash
npx serve apps/techweekly      # or any site dir
```

Landing sites stream the clip from R2 (`config.js`). For a fully offline preview,
drop a `latest-footage.mp4` into the site dir and set `video: "./latest-footage.mp4"`.
