// Security headers applied to every HTML document response.
// Kept permissive enough for SSR inline scripts, Google Fonts, Supabase and
// the Lovable preview/editor embed, while blocking third-party framing.

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "manifest-src 'self'",

  "object-src 'none'",
  "form-action 'self'",
  // SSR hydration + Vite inject inline scripts; the Lovable editor script is CDN hosted.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.gpteng.co https://*.lovable.app https://*.lovable.dev",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' ws: wss: https://*.supabase.co https://*.lovable.app https://*.lovable.dev https://cdn.gpteng.co",
  "frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev https://lovable.dev",
  "frame-src 'self' https://accounts.google.com",
  "upgrade-insecure-requests",
].join("; ");

const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

/**
 * Copies an HTML response and adds the security headers (CSP, frame, MIME,
 * referrer, HSTS, permissions policy). Non-HTML responses pass through
 * untouched so assets and JSON payloads are not rewritten.
 */
export function applySecurityHeaders(response: Response): Response {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", CSP_DIRECTIVES);
  // Legacy clickjacking guard. Modern browsers prefer CSP frame-ancestors above,
  // which still allows the Lovable preview embed.
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
