import { appendFileSync, readFileSync } from "node:fs";

const outputFlag = process.argv.indexOf("--github-output");
const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : undefined;
if (!outputPath) throw new Error("Pass --github-output with the GitHub output file path");

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const isManual = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
let targetUrl;
let samples;
let pullRequestNumber = "";

if (isManual) {
  targetUrl = event.inputs?.target_url?.trim();
  samples = event.inputs?.samples?.trim() || "20";
} else {
  const firstLine = String(event.comment?.body ?? "").split(/\r?\n/, 1)[0].trim();
  const match = firstLine.match(/^\/performance-baseline\s+(\S+)(?:\s+(\d+))?\s*$/i);
  if (!match) {
    throw new Error("Use /performance-baseline <url> [samples]");
  }
  targetUrl = match[1];
  samples = match[2] ?? "20";
  pullRequestNumber = String(event.issue?.number ?? "");
}

if (!targetUrl) throw new Error("A target URL is required");
const parsedUrl = new URL(targetUrl);
if (!["http:", "https:"].includes(parsedUrl.protocol)) {
  throw new Error("The target URL must use HTTP or HTTPS");
}
if (parsedUrl.username || parsedUrl.password) {
  throw new Error("The target URL must not contain credentials");
}
const sampleCount = Number(samples);
if (!Number.isInteger(sampleCount) || sampleCount < 5 || sampleCount > 100) {
  throw new Error("Samples must be an integer between 5 and 100");
}

appendFileSync(
  outputPath,
  [
    `base_url=${parsedUrl.toString()}`,
    `samples=${sampleCount}`,
    `pr_number=${pullRequestNumber}`,
  ].join("\n") + "\n",
  "utf8",
);
