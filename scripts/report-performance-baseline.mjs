import { appendFileSync, existsSync, readFileSync } from "node:fs";

const resultPath = "performance-baseline.jsonl";
const outcome = process.env.BASELINE_OUTCOME ?? "unknown";
const target = process.env.BASELINE_URL ?? "unknown target";
const escapeCell = (value) => String(value ?? "—").replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
const withSuffix = (value, suffix) => value == null ? "—" : `${escapeCell(value)}${suffix}`;
const transition = (first, last, suffix = "") =>
  `${withSuffix(first, suffix)} → ${withSuffix(last, suffix)}`;
const latencyPair = (p50, p95) => `${p50} / ${p95} ms`;

let markdown = `## Performance baseline ${outcome === "success" ? "✅" : "❌"}\n\n`;
markdown += `Target: ${escapeCell(target)}\n\n`;

const resultText = existsSync(resultPath) ? readFileSync(resultPath, "utf8").trim() : "";
if (resultText) {
  const rows = resultText.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  markdown += "| API path | Samples | First | Overall p50 / p95 | Warm p50 / p95 | CDN first → last | Age first → last |\n";
  markdown += "| --- | ---: | ---: | ---: | ---: | --- | --- |\n";
  for (const row of rows) {
    markdown += `| ${escapeCell(row.path)} | ${row.samples} | ${row.firstMs} ms | ${latencyPair(row.p50Ms, row.p95Ms)} | ${latencyPair(row.warmP50Ms, row.warmP95Ms)} | ${transition(row.firstCacheStatus, row.lastCacheStatus)} | ${transition(row.firstAgeSeconds, row.lastAgeSeconds, "s")} |\n`;
  }

  markdown += "\n| API path | Cache-Control | Origin probe | Origin time | Origin Server-Timing |\n";
  markdown += "| --- | --- | --- | ---: | --- |\n";
  for (const row of rows) {
    markdown += `| ${escapeCell(row.path)} | ${escapeCell(row.cacheControl)} | ${escapeCell(row.originCacheStatus)} | ${withSuffix(row.originProbeMs, " ms")} | ${escapeCell(row.originServerTiming)} |\n`;
  }
  markdown += "\nThe origin probe sends `Pragma: no-cache` and `Cache-Control: no-cache`. Treat `Server-Timing` as origin evidence only when the probe status is `MISS` or `REVALIDATED`; normal `HIT` samples do not invoke the application.\n";
} else {
  markdown += "The measurement did not produce a result file. Open the workflow run for the failure details.\n";
}

markdown += `\n[Open workflow run](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})`;

const summaryFlag = process.argv.indexOf("--github-summary");
const summaryPath = summaryFlag >= 0 ? process.argv[summaryFlag + 1] : undefined;
if (summaryPath) appendFileSync(summaryPath, `${markdown}\n`, "utf8");
else process.stdout.write(markdown);
