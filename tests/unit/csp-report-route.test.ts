import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSecurityHeaders } from "@/lib/security-headers";
import {
  CSP_REPORT_IP_RATE_LIMIT,
  resetAllRateLimits,
} from "@/lib/rate-limit";

function createCspReportRequest(body: unknown, init: RequestInit = {}) {
  return new Request("http://localhost:3000/api/csp-report", {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "Content-Type": "application/csp-report",
      "x-forwarded-for": "203.0.113.20",
      ...init.headers,
    },
    method: "POST",
    ...init,
  });
}

describe("CSP report-only headers", () => {
  it("adds the report-only CSP header without adding the enforcing CSP header", () => {
    const headers = getSecurityHeaders({
      isDevelopment: false,
      isProduction: true,
    });
    const headerKeys = headers.map((header) => header.key);
    const reportOnlyHeader = headers.find(
      (header) => header.key === "Content-Security-Policy-Report-Only",
    );

    expect(reportOnlyHeader?.value).toContain("default-src 'self'");
    expect(reportOnlyHeader?.value).toContain("object-src 'none'");
    expect(reportOnlyHeader?.value).toContain("base-uri 'self'");
    expect(reportOnlyHeader?.value).toContain("frame-ancestors 'none'");
    expect(reportOnlyHeader?.value).toContain("form-action 'self'");
    expect(reportOnlyHeader?.value).toContain("report-uri /api/csp-report");
    expect(headerKeys).toContain("Content-Security-Policy-Report-Only");
    expect(headerKeys).not.toContain("Content-Security-Policy");
  });

  it("keeps development-only CSP allowances out of production", () => {
    const productionHeader = getSecurityHeaders({
      isDevelopment: false,
      isProduction: true,
    }).find((header) => header.key === "Content-Security-Policy-Report-Only");
    const developmentHeader = getSecurityHeaders({
      isDevelopment: true,
      isProduction: false,
    }).find((header) => header.key === "Content-Security-Policy-Report-Only");

    expect(productionHeader?.value).not.toContain("'unsafe-eval'");
    expect(productionHeader?.value).not.toContain("https://va.vercel-scripts.com");
    expect(developmentHeader?.value).toContain("'unsafe-eval'");
    expect(developmentHeader?.value).toContain("https://va.vercel-scripts.com");
  });
});

describe("/api/csp-report", () => {
  beforeEach(() => {
    resetAllRateLimits();
    vi.restoreAllMocks();
  });

  it("accepts a valid legacy CSP report without logging raw URLs or tokens", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { POST } = await import("@/app/api/csp-report/route");

    const response = await POST(
      createCspReportRequest({
        "csp-report": {
          "blocked-uri":
            "https://evil.example/collect?token=secret-token&email=user@example.com",
          "document-uri": "https://memo.example/posts?authorization=Bearer secret",
          disposition: "report",
          "effective-directive": "script-src",
          "violated-directive": "script-src-elem",
        },
      }),
    );
    const logText = infoSpy.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(response.status).toBe(204);
    expect(logText).toContain("cspReportReceived");
    expect(logText).toContain("script-src");
    expect(logText).not.toContain("secret-token");
    expect(logText).not.toContain("user@example.com");
    expect(logText).not.toContain("Bearer secret");
    expect(logText).not.toContain("evil.example");
  });

  it("rejects malformed CSP report input", async () => {
    const { POST } = await import("@/app/api/csp-report/route");

    const response = await POST(createCspReportRequest({ nope: true }));

    expect(response.status).toBe(400);
  });

  it("rejects oversized CSP report bodies", async () => {
    const { POST } = await import("@/app/api/csp-report/route");

    const response = await POST(
      createCspReportRequest("{}", {
        headers: {
          "Content-Length": String(20 * 1024),
          "Content-Type": "application/csp-report",
          "x-forwarded-for": "203.0.113.21",
        },
      }),
    );

    expect(response.status).toBe(413);
  });

  it("rate limits CSP report submissions by client IP", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { POST } = await import("@/app/api/csp-report/route");

    for (let index = 0; index < CSP_REPORT_IP_RATE_LIMIT.max; index += 1) {
      const response = await POST(
        createCspReportRequest({
          "csp-report": {
            disposition: "report",
            "effective-directive": "img-src",
          },
        }),
      );

      expect(response.status).toBe(204);
    }

    const response = await POST(
      createCspReportRequest({
        "csp-report": {
          disposition: "report",
          "effective-directive": "img-src",
        },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Limit")).toBe(
      String(CSP_REPORT_IP_RATE_LIMIT.max),
    );
  });
});
