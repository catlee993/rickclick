// Allocator rickroll config. The Shrek/easter-egg clip streams from the same
// gatekeeper worker as the landing sites (private R2 + signed URLs).
// `video` is an optional local-dev fallback.
window.RICK_CONFIG = {
  brand: "rickclick",
  signEndpoint: "https://media.rickclick.com/sign",
  revealAt: 0,
  video: "./latest-footage.mp4"
};
