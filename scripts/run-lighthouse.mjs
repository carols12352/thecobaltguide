import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const port = Number.parseInt(process.env.LIGHTHOUSE_PORT ?? "3001", 10);
const origin = `http://127.0.0.1:${port}`;
const routes = ["/", "/about"];
const sampleCount = Math.max(
  1,
  Number.parseInt(process.env.LIGHTHOUSE_RUNS ?? "3", 10) || 3,
);
const artifactDirectory =
  process.env.LIGHTHOUSE_ARTIFACT_DIR ??
  path.join(os.tmpdir(), "thecobaltguide-lighthouse");
const budgets = {
  performance: 0.7,
  accessibility: 0.9,
  "best-practices": 0.9,
  seo: 0.9,
};

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Production server did not become ready at ${origin}.`);
}

function stopServer(server) {
  if (!server.pid) return;
  try {
    if (process.platform === "win32") server.kill("SIGTERM");
    else process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const server = spawn(
  npmCommand,
  ["start", "--", "--hostname", "127.0.0.1", "--port", String(port)],
  { detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

try {
  await waitForServer();
  await mkdir(artifactDirectory, { recursive: true });

  const failures = [];
  const summary = [];
  for (const route of routes) {
    const routeSlug = route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
    const samples = [];

    for (let sample = 1; sample <= sampleCount; sample += 1) {
      const chrome = await chromeLauncher.launch({
        chromeFlags: ["--headless=new", "--no-sandbox"],
      });

      try {
        const result = await lighthouse(`${origin}${route}`, {
          port: chrome.port,
          logLevel: "error",
          output: ["json", "html"],
          onlyCategories: Object.keys(budgets),
        });
        if (!result) {
          throw new Error(`Lighthouse returned no result for ${route}, sample ${sample}.`);
        }

        const reports = Array.isArray(result.report)
          ? result.report
          : [result.report];
        await Promise.all([
          writeFile(
            path.join(artifactDirectory, `${routeSlug}-${sample}.json`),
            reports[0],
          ),
          writeFile(
            path.join(artifactDirectory, `${routeSlug}-${sample}.html`),
            reports[1] ?? "",
          ),
        ]);

        const scores = Object.fromEntries(
          Object.keys(budgets).map((category) => [
            category,
            result.lhr.categories[category]?.score ?? 0,
          ]),
        );
        const metrics = Object.fromEntries(
          [
            ["fcp", "first-contentful-paint"],
            ["lcp", "largest-contentful-paint"],
            ["speedIndex", "speed-index"],
            ["tbt", "total-blocking-time"],
            ["cls", "cumulative-layout-shift"],
          ].map(([label, auditId]) => [
            label,
            Math.round((result.lhr.audits[auditId]?.numericValue ?? 0) * 100) /
              100,
          ]),
        );
        const sampleResult = { sample, scores, metrics };
        samples.push(sampleResult);
        console.log(`${route} sample ${sample} ${JSON.stringify(sampleResult)}`);
      } finally {
        await chrome.kill();
      }
    }

    const medianScores = Object.fromEntries(
      Object.entries(budgets).map(([category, minimum]) => {
        const ordered = samples
          .map(({ scores }) => scores[category] ?? 0)
          .sort((left, right) => left - right);
        const median = ordered[Math.floor(ordered.length / 2)] ?? 0;
        if (median < minimum) {
          failures.push(`${route} ${category} median: ${median} < ${minimum}`);
        }
        return [category, Math.round(median * 100)];
      }),
    );
    summary.push({ route, samples, medianScores });
    console.log(`${route} median ${JSON.stringify(medianScores)}`);
  }

  await writeFile(
    path.join(artifactDirectory, "summary.json"),
    `${JSON.stringify({ sampleCount, budgets, routes: summary }, null, 2)}\n`,
  );
  console.log(`Lighthouse reports: ${artifactDirectory}`);

  if (failures.length) throw new Error(`Lighthouse budgets failed:\n${failures.join("\n")}`);
} catch (error) {
  if (server.exitCode !== null) {
    console.error(serverOutput.trim());
  }
  throw error;
} finally {
  stopServer(server);
}
