import { appendFileSync, existsSync, readFileSync } from "node:fs";

const resultPath = "performance-baseline.jsonl";
const outcome = process.env.BASELINE_OUTCOME ?? "unknown";
const target = process.env.BASELINE_URL ?? "unknown target";
const escapeCell = (value) => String(value ?? "—").replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");

let markdown = `## Performance baseline ${outcome === "success" ? "✅" : "❌"}\n\n`;
markdown += `Target: ${escapeCell(target)}\n\n`;

const resultText = existsSync(resultPath) ? readFileSync(resultPath, "utf8").trim() : "";
if (resultText) {
  const rows = resultText.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  markdown += "| API path | Samples | p50 | p95 | Cache-Control | Server-Timing |\n";
  markdown += "| --- | ---: | ---: | ---: | --- | --- |\n";
  for (const row of rows) {
    markdown += `| ${escapeCell(row.path)} | ${row.samples} | ${row.p50Ms} ms | ${row.p95Ms} ms | ${escapeCell(row.cacheControl)} | ${escapeCell(row.lastServerTiming)} |\n`;
  }
} else {
  markdown += "The measurement did not produce a result file. Open the workflow run for the failure details.\n";
}

markdown += `\n[Open workflow run](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})`;

const summaryFlag = process.argv.indexOf("--github-summary");
const summaryPath = summaryFlag >= 0 ? process.argv[summaryFlag + 1] : undefined;
if (summaryPath) appendFileSync(summaryPath, `${markdown}\n`, "utf8");
else process.stdout.write(markdown);
