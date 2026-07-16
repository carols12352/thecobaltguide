import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const baseUrl = process.env.BASELINE_BASE_URL;
if (!baseUrl) throw new Error("Set BASELINE_BASE_URL to a local, preview, or production URL");

function isPrivateAddress(address) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isPrivateAddress(normalized.slice(7));
  }
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 0 || a === 10 || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224;
  }
  return normalized === "::" || normalized === "::1"
    || normalized.startsWith("fc") || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized);
}

async function validateBaseUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("BASELINE_BASE_URL must use HTTP or HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("BASELINE_BASE_URL must not contain credentials");
  }
  if (process.env.BASELINE_ALLOW_PRIVATE_NETWORK === "true") return url;
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
    throw new Error("Private baseline targets require BASELINE_ALLOW_PRIVATE_NETWORK=true");
  }
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("BASELINE_BASE_URL resolves to a private or non-routable address");
  }
  return url;
}

const validatedBaseUrl = await validateBaseUrl(baseUrl);

function vercelBypassHeaders(url) {
  const secret = process.env.BASELINE_VERCEL_BYPASS_SECRET?.trim();
  if (!secret) return {};

  const prefix = process.env.BASELINE_VERCEL_HOST_PREFIX?.trim().toLowerCase();
  const suffix = process.env.BASELINE_VERCEL_HOST_SUFFIX?.trim().toLowerCase();
  if (!prefix || !suffix) {
    throw new Error("Vercel bypass host boundaries must be configured with the bypass secret");
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname.startsWith(prefix) || !hostname.endsWith(suffix)) return {};

  return { "x-vercel-protection-bypass": secret };
}

const requestHeaders = vercelBypassHeaders(validatedBaseUrl);

const samples = Number(process.env.BASELINE_SAMPLES ?? 20);
if (!Number.isInteger(samples) || samples < 5 || samples > 100) {
  throw new Error("BASELINE_SAMPLES must be an integer between 5 and 100");
}
const paths = (process.env.BASELINE_PATHS ?? "/api/places/map?north=43.7&south=43.6&east=-79.3&west=-79.4&zoom=13,/api/places/search?q=cafe")
  .split(",");

const percentile = (values, quantile) =>
  values.slice().sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * quantile) - 1)];

for (const path of paths) {
  const durations = [];
  const observations = [];
  let cacheControl = null;
  for (let index = 0; index < samples; index++) {
    const startedAt = performance.now();
    const response = await fetch(new URL(path, validatedBaseUrl), {
      cache: "no-store",
      headers: requestHeaders,
      redirect: "error",
    });
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
    await response.arrayBuffer();
    durations.push(performance.now() - startedAt);
    cacheControl = response.headers.get("cache-control");
    observations.push({
      cacheStatus: response.headers.get("x-vercel-cache"),
      ageSeconds: response.headers.get("age"),
      serverTiming: response.headers.get("server-timing"),
    });
  }
  const warmDurations = durations.slice(1);
  const first = observations[0];
  const last = observations.at(-1);
  console.log(JSON.stringify({
    path,
    samples,
    firstMs: Math.round(durations[0]),
    p50Ms: Math.round(percentile(durations, 0.5)),
    p95Ms: Math.round(percentile(durations, 0.95)),
    warmP50Ms: Math.round(percentile(warmDurations, 0.5)),
    warmP95Ms: Math.round(percentile(warmDurations, 0.95)),
    cacheControl,
    firstCacheStatus: first?.cacheStatus ?? null,
    lastCacheStatus: last?.cacheStatus ?? null,
    firstAgeSeconds: first?.ageSeconds ?? null,
    lastAgeSeconds: last?.ageSeconds ?? null,
    firstServerTiming: first?.serverTiming ?? null,
    lastServerTiming: last?.serverTiming ?? null,
  }));
}
