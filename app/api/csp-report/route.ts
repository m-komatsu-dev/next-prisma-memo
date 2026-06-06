import { NextResponse } from "next/server";
import { z } from "zod";
import {
  consumeRateLimit,
  CSP_REPORT_IP_RATE_LIMIT,
  getClientIp,
  getRateLimitHeaders,
  makeRateLimitKey,
} from "@/lib/rate-limit";

const MAX_CSP_REPORT_BYTES = 16 * 1024;
const MAX_REPORTS_PER_REQUEST = 10;
const directiveSchema = z.string().trim().min(1).max(128);
const reportStringSchema = z.string().max(2048);
const dispositionSchema = z.enum(["enforce", "report"]);

const legacyCspReportSchema = z
  .object({
    "blocked-uri": reportStringSchema.optional(),
    "column-number": z.number().int().nonnegative().optional(),
    "document-uri": reportStringSchema.optional(),
    disposition: dispositionSchema.optional(),
    "effective-directive": directiveSchema.optional(),
    "line-number": z.number().int().nonnegative().optional(),
    "original-policy": reportStringSchema.optional(),
    referrer: reportStringSchema.optional(),
    "script-sample": reportStringSchema.optional(),
    "source-file": reportStringSchema.optional(),
    "status-code": z.number().int().nonnegative().optional(),
    "violated-directive": directiveSchema.optional(),
  })
  .passthrough();

const reportToBodySchema = z
  .object({
    blockedURL: reportStringSchema.optional(),
    disposition: dispositionSchema.optional(),
    documentURL: reportStringSchema.optional(),
    effectiveDirective: directiveSchema.optional(),
    originalPolicy: reportStringSchema.optional(),
    referrer: reportStringSchema.optional(),
    sample: reportStringSchema.optional(),
    sourceFile: reportStringSchema.optional(),
    statusCode: z.number().int().nonnegative().optional(),
    violatedDirective: directiveSchema.optional(),
  })
  .passthrough();

const reportToSchema = z
  .object({
    age: z.number().nonnegative().optional(),
    body: reportToBodySchema,
    type: z.literal("csp-violation"),
    url: reportStringSchema.optional(),
    user_agent: reportStringSchema.optional(),
  })
  .passthrough();

const cspReportSchema = z.union([
  z.object({ "csp-report": legacyCspReportSchema }).passthrough(),
  reportToSchema,
  z.array(reportToSchema).min(1).max(MAX_REPORTS_PER_REQUEST),
]);

class BodyTooLargeError extends Error {}

export async function POST(request: Request) {
  const rateLimit = consumeRateLimit(
    makeRateLimitKey("csp-report:ip", [getClientIp(request)]),
    CSP_REPORT_IP_RATE_LIMIT,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many CSP reports." },
      {
        headers: getRateLimitHeaders(rateLimit),
        status: 429,
      },
    );
  }

  if (!isSupportedContentType(request.headers.get("content-type"))) {
    return NextResponse.json(
      { error: "Unsupported media type." },
      { status: 415 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_CSP_REPORT_BYTES) {
    return NextResponse.json(
      { error: "CSP report is too large." },
      { status: 413 },
    );
  }

  let text: string;
  try {
    text = await readLimitedText(request);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json(
        { error: "CSP report is too large." },
        { status: 413 },
      );
    }

    return NextResponse.json(
      { error: "Failed to read CSP report." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "CSP report must be valid JSON." },
      { status: 400 },
    );
  }

  const validated = cspReportSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Invalid CSP report." },
      { status: 400 },
    );
  }

  logCspReportSummary(validated.data, request.url);
  return new NextResponse(null, { status: 204 });
}

function isSupportedContentType(contentType: string | null) {
  if (!contentType) {
    return false;
  }

  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  return (
    mediaType === "application/csp-report" ||
    mediaType === "application/json" ||
    mediaType === "application/reports+json"
  );
}

async function readLimitedText(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    byteLength += value.byteLength;
    if (byteLength > MAX_CSP_REPORT_BYTES) {
      throw new BodyTooLargeError();
    }

    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

function logCspReportSummary(
  report: z.infer<typeof cspReportSchema>,
  requestUrl: string,
) {
  const summaries = Array.isArray(report)
    ? report.map((entry) => summarizeReportTo(entry, requestUrl))
    : isLegacyCspReport(report)
      ? [summarizeLegacyReport(report["csp-report"], requestUrl)]
      : [summarizeReportTo(report, requestUrl)];

  console.info(
    JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      context: {
        action: "cspReportReceived",
        details: {
          reportCount: summaries.length,
          reports: summaries,
        },
      },
    }),
  );
}

function isLegacyCspReport(
  report: Exclude<z.infer<typeof cspReportSchema>, z.infer<typeof reportToSchema>[]>,
): report is { "csp-report": z.infer<typeof legacyCspReportSchema> } {
  return "csp-report" in report;
}

function summarizeLegacyReport(
  report: z.infer<typeof legacyCspReportSchema>,
  requestUrl: string,
) {
  return {
    blockedUriType: classifyUri(report["blocked-uri"], requestUrl),
    disposition: report.disposition ?? "unknown",
    effectiveDirective: sanitizeDirective(report["effective-directive"]),
    statusCode: report["status-code"] ?? null,
    violatedDirective: sanitizeDirective(report["violated-directive"]),
  };
}

function summarizeReportTo(
  report: z.infer<typeof reportToSchema>,
  requestUrl: string,
) {
  return {
    blockedUriType: classifyUri(report.body.blockedURL, requestUrl),
    disposition: report.body.disposition ?? "unknown",
    effectiveDirective: sanitizeDirective(report.body.effectiveDirective),
    statusCode: report.body.statusCode ?? null,
    violatedDirective: sanitizeDirective(report.body.violatedDirective),
  };
}

function sanitizeDirective(value: string | undefined) {
  if (!value || !/^[a-z-]+$/i.test(value)) {
    return "unknown";
  }

  return value.toLowerCase();
}

function classifyUri(value: string | undefined, requestUrl: string) {
  if (!value) {
    return "missing";
  }

  if (["inline", "eval", "wasm-eval"].includes(value)) {
    return value;
  }

  if (value.startsWith("data:")) {
    return "data";
  }

  if (value.startsWith("blob:")) {
    return "blob";
  }

  try {
    const blockedUrl = new URL(value);
    return blockedUrl.origin === new URL(requestUrl).origin
      ? "same-origin"
      : "external";
  } catch {
    return "invalid";
  }
}
