/*
 * Shared rickroll engine for the themed landing sites.
 * Config is provided per-site via window.RICK_CONFIG (see config.js):
 *   { brand, signEndpoint: "<worker>/sign", revealAt, video? }
 *
 * The clip lives in a PRIVATE R2 bucket. We fetch a short-lived signed URL from
 * the gatekeeper worker's /sign endpoint (origin-locked) and stream that. A
 * fresh token is pre-fetched on load and refreshed on a timer, so the consent
 * click can start unmuted playback immediately within the user gesture.
 * `video` (a direct URL/path) is an optional fallback for local dev.
 */
(function () {
  var CFG = window.RICK_CONFIG || {};
  var SIGN = CFG.signEndpoint || null;
  var FALLBACK = CFG.video || null;
  var REVEAL_AT = (CFG.revealAt != null) ? CFG.revealAt : 0;

  var cachedSrc = FALLBACK; // used immediately if no signing endpoint
  var refreshTimer = null;

  function fetchSigned() {
    if (!SIGN) return Promise.resolve(FALLBACK);
    return fetch(SIGN, { method: "GET", credentials: "omit", cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("sign " + r.status); return r.json(); })
      .then(function (j) {
        cachedSrc = j.url;
        // Refresh a little before the token expires so it's always warm.
        if (refreshTimer) clearTimeout(refreshTimer);
        var ms = Math.max(15, (j.ttl || 120) - 30) * 1000;
        refreshTimer = setTimeout(function () { fetchSigned().catch(function () {}); }, ms);
        return cachedSrc;
      });
  }

  function deslug() {
    var p = "";
    try { p = decodeURIComponent(location.pathname); } catch (e) { p = location.pathname; }
    p = p.replace(/^\/+|\/+$/g, "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
    if (!p) return null;
    return p.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function setHeadline() {
    var h = deslug();
    if (!h) return;
    var el = document.querySelector("[data-headline]");
    if (el) el.textContent = h;
    document.title = h + (CFG.brand ? " | " + CFG.brand : "");
  }

  function play(overlay, src) {
    var video = document.createElement("video");
    video.src = src;
    video.autoplay = true;
    video.controls = false;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.className = "rr-video";
    overlay.appendChild(video);

    function seekAndPlay() {
      try { if (REVEAL_AT) video.currentTime = REVEAL_AT; } catch (e) {}
      var attempt = video.play();
      if (attempt && attempt.catch) {
        attempt.catch(function () {
          var btn = document.createElement("button");
          btn.className = "rr-play";
          btn.textContent = "▶ Play";
          btn.addEventListener("click", function () { video.play(); btn.remove(); });
          overlay.appendChild(btn);
        });
      }
    }
    if (video.readyState >= 1) seekAndPlay();
    else video.addEventListener("loadedmetadata", seekAndPlay);

    video.addEventListener("ended", function () {
      try { video.currentTime = REVEAL_AT || 0; } catch (e) {}
      video.play();
    });
  }

  function rickroll() {
    var consent = document.querySelector(".rr-consent");
    if (consent) consent.remove();

    var overlay = document.createElement("div");
    overlay.className = "rr-overlay";
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    if (cachedSrc) {
      play(overlay, cachedSrc);
      // refresh in the background for any later replays
      fetchSigned().catch(function () {});
    } else {
      var loading = document.createElement("div");
      loading.className = "rr-play";
      loading.textContent = "Loading…";
      overlay.appendChild(loading);
      fetchSigned().then(function (src) {
        loading.remove();
        if (src) play(overlay, src);
      }).catch(function () { loading.textContent = "▶ Play"; });
    }
  }

  function mountConsent() {
    var bar = document.createElement("div");
    bar.className = "rr-consent";
    bar.innerHTML =
      '<div class="rr-consent-inner">' +
        '<div class="rr-consent-text">' +
          "<strong>We value your privacy</strong>" +
          "<p>We and our 1,482 partners use cookies to store and access information " +
          "on your device to deliver personalised content and measure performance. " +
          "You can accept all, or manage your preferences.</p>" +
        "</div>" +
        '<div class="rr-consent-actions">' +
          '<button class="rr-btn rr-btn-ghost" data-act="manage">Manage options</button>' +
          '<button class="rr-btn rr-btn-ghost" data-act="reject">Reject all</button>' +
          '<button class="rr-btn rr-btn-primary" data-act="accept">Accept all</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(bar);
    var btns = bar.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", rickroll);
    }
  }

  function init() {
    setHeadline();
    mountConsent();
    fetchSigned().catch(function () {}); // warm a token up front
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
