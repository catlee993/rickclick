// Hide the *.pages.dev URL (301 -> real domain), keep the prank site out of
// search, AND inject a per-slug headline into the share-preview meta tags so a
// pasted link shows a believable, matching news card (scrapers don't run JS,
// so this must happen server-side).
const CANONICAL = "bizwiz.lol";
const SITE = "BizWiz";

function deslug(pathname) {
  let p = "";
  try { p = decodeURIComponent(pathname); } catch (e) { p = pathname; }
  p = p.replace(/^\/+|\/+$/g, "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  if (!p) return null;
  return p.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname.endsWith(".pages.dev")) {
    url.hostname = CANONICAL;
    url.protocol = "https:";
    url.port = "";
    return Response.redirect(url.toString(), 301);
  }

  const res = await context.next();
  const ct = res.headers.get("content-type") || "";

  if (ct.includes("text/html")) {
    const headline = deslug(url.pathname);
    const canonicalUrl = "https://" + CANONICAL + url.pathname;
    let transformed = res;
    if (headline) {
      transformed = new HTMLRewriter()
        .on('meta[property="og:title"]',  { element(e) { e.setAttribute("content", headline); } })
        .on('meta[name="twitter:title"]', { element(e) { e.setAttribute("content", headline); } })
        .on('meta[property="og:url"]',    { element(e) { e.setAttribute("content", canonicalUrl); } })
        .on("title",                      { element(e) { e.setInnerContent(headline + " | " + SITE); } })
        .transform(res);
    }
    const out = new Response(transformed.body, transformed);
    out.headers.set("X-Robots-Tag", "noindex, nofollow");
    return out;
  }

  const out = new Response(res.body, res);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (url.pathname.endsWith(".js")) out.headers.set("Cache-Control", "no-cache");
  return out;
}
