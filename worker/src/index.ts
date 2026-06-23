/*
 * rickclick-media — gatekeeper for the rickroll clip.
 *
 * The R2 bucket is PRIVATE. This worker is the only thing that can read it.
 *
 *   GET /sign   -> if the caller's Origin/Referer is allow-listed, returns a
 *                  short-lived HMAC-signed URL for the clip. (CORS-enabled.)
 *   GET /v/<key>?exp=&sig=
 *               -> verifies the signature + expiry, then streams the object
 *                  with HTTP Range support (for seeking). No valid token => no bytes.
 *
 * So the video is both signed (expiring, tamper-proof) and origin-locked.
 */

export interface Env {
  MEDIA: R2Bucket;
  SIGNING_KEY: string;
  ALLOWED_ORIGINS: string;
  VIDEO_KEY: string;
  TTL_SECONDS: string;
}

function allowList(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (origin && allowed.includes(origin)) {
    return { "Access-Control-Allow-Origin": origin, "Vary": "Origin" };
  }
  return { "Vary": "Origin" };
}

function toHex(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

async function hmac(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// R2 reads can occasionally hiccup — retry once before giving up.
async function r2head(env: Env, key: string) {
  try { return await env.MEDIA.head(key); }
  catch (e) { return await env.MEDIA.head(key); }
}
async function r2get(env: Env, key: string, opts?: R2GetOptions) {
  try { return await env.MEDIA.get(key, opts); }
  catch (e) { return await env.MEDIA.get(key, opts); }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
   try {
    const url = new URL(req.url);
    const allowed = allowList(env);
    const origin = req.headers.get("Origin");
    const KEY = env.VIDEO_KEY;
    const TTL = parseInt(env.TTL_SECONDS || "120", 10);

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(origin, allowed),
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // --- mint a short-lived signed URL, origin/referer gated ---
    if (url.pathname === "/sign") {
      const referer = req.headers.get("Referer") || "";
      const originOk = origin ? allowed.includes(origin) : false;
      const refererOk = allowed.some((o) => referer.startsWith(o + "/") || referer === o);
      if (!originOk && !refererOk) {
        return new Response("forbidden", { status: 403, headers: corsHeaders(origin, allowed) });
      }
      const exp = Math.floor(Date.now() / 1000) + TTL;
      const sig = await hmac(env.SIGNING_KEY, `${KEY}:${exp}`);
      const signed = `${url.origin}/v/${encodeURIComponent(KEY)}?exp=${exp}&sig=${sig}`;
      return new Response(JSON.stringify({ url: signed, ttl: TTL }), {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          ...corsHeaders(origin, allowed),
        },
      });
    }

    // --- stream the object if the token verifies ---
    if (url.pathname === `/v/${encodeURIComponent(KEY)}` || url.pathname === `/v/${KEY}`) {
      const exp = parseInt(url.searchParams.get("exp") || "0", 10);
      const sig = url.searchParams.get("sig") || "";
      if (!exp || Math.floor(Date.now() / 1000) > exp) {
        return new Response("link expired", { status: 410 });
      }
      const expected = await hmac(env.SIGNING_KEY, `${KEY}:${exp}`);
      if (!timingSafeEqual(sig, expected)) {
        return new Response("bad signature", { status: 403 });
      }

      const head = await r2head(env, KEY);
      if (!head) return new Response("not found", { status: 404 });
      const size = head.size;
      const contentType = head.httpMetadata?.contentType || "video/mp4";

      const headers = new Headers({
        "content-type": contentType,
        "accept-ranges": "bytes",
        "cache-control": "private, no-store",
      });

      const range = req.headers.get("Range");
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        let start = m && m[1] ? parseInt(m[1], 10) : 0;
        let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end) || end >= size) end = size - 1;
        if (start > end) return new Response("range not satisfiable", { status: 416 });
        const obj = await r2get(env, KEY, { range: { offset: start, length: end - start + 1 } });
        if (!obj) return new Response("not found", { status: 404 });
        headers.set("content-range", `bytes ${start}-${end}/${size}`);
        headers.set("content-length", String(end - start + 1));
        return new Response(obj.body, { status: 206, headers });
      }

      const obj = await r2get(env, KEY);
      if (!obj) return new Response("not found", { status: 404 });
      headers.set("content-length", String(size));
      return new Response(obj.body, { status: 200, headers });
    }

    return new Response("not found", { status: 404 });
   } catch (e) {
    // Never 500 — return a retryable status so the client self-heals.
    return new Response("temporarily unavailable", { status: 503 });
   }
  },
};
