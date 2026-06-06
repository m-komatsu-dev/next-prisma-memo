type SecurityHeader = {
  key: string;
  value: string;
};

type ContentSecurityPolicyOptions = {
  isDevelopment?: boolean;
};

export const CSP_REPORT_ENDPOINT = "/api/csp-report";

export function buildContentSecurityPolicy({
  isDevelopment = process.env.NODE_ENV !== "production",
}: ContentSecurityPolicyOptions = {}) {
  const directives = new Map<string, string[]>([
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
    ["frame-ancestors", ["'none'"]],
    ["form-action", ["'self'"]],
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["font-src", ["'self'", "data:"]],
    ["media-src", ["'self'", "blob:"]],
    ["connect-src", ["'self'", "https://*.vercel-insights.com"]],
    ["script-src", ["'self'", "'unsafe-inline'"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["report-uri", [CSP_REPORT_ENDPOINT]],
  ]);

  if (isDevelopment) {
    directives.get("script-src")?.push("'unsafe-eval'", "https://va.vercel-scripts.com");
    directives.get("connect-src")?.push("ws:", "http://localhost:*", "https://va.vercel-scripts.com");
    directives.get("img-src")?.push("http://localhost:*");
  }

  return Array.from(directives.entries())
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");
}

export function getSecurityHeaders({
  isProduction = process.env.NODE_ENV === "production",
  isDevelopment = process.env.NODE_ENV !== "production",
}: {
  isProduction?: boolean;
  isDevelopment?: boolean;
} = {}): SecurityHeader[] {
  const securityHeaders: SecurityHeader[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
    },
    {
      key: "Content-Security-Policy-Report-Only",
      value: buildContentSecurityPolicy({ isDevelopment }),
    },
  ];

  if (isProduction) {
    securityHeaders.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return securityHeaders;
}
