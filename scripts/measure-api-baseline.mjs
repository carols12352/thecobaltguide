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
  let serverTiming = null;
  let cacheControl = null;
  for (let index = 0; index < samples; index++) {
    const startedAt = performance.now();
    const response = await fetch(new URL(path, validatedBaseUrl), {
      cache: "no-store",
      redirect: "error",
    });
    durations.push(performance.now() - startedAt);
    serverTiming = response.headers.get("server-timing");
    cacheControl = response.headers.get("cache-control");
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
    await response.arrayBuffer();
  }
  console.log(JSON.stringify({
    path,
    samples,
    p50Ms: Math.round(percentile(durations, 0.5)),
    p95Ms: Math.round(percentile(durations, 0.95)),
    cacheControl,
    lastServerTiming: serverTiming,
  }));
}
