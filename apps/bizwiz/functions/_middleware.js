// Hide the *.pages.dev URL: 301 it to the real domain, and keep the prank
// site out of search engines entirely (we hand out links directly).
const CANONICAL = "bizwiz.lol";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname.endsWith(".pages.dev")) {
    url.hostname = CANONICAL;
    url.protocol = "https:";
    url.port = "";
    return Response.redirect(url.toString(), 301);
  }
  const res = await context.next();
  const out = new Response(res.body, res);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  // Keep the small control scripts fresh so config/worker-URL changes propagate
  // immediately instead of being stuck behind a multi-hour asset cache.
  if (url.pathname.endsWith(".js")) out.headers.set("Cache-Control", "no-cache");
  return out;
}
