import { spawn } from "node:child_process";
import process from "node:process";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const port = Number.parseInt(process.env.LIGHTHOUSE_PORT ?? "3001", 10);
const origin = `http://127.0.0.1:${port}`;
const routes = ["/", "/about"];
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

let chrome;
try {
  await waitForServer();
  chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox"],
  });

  const failures = [];
  for (const route of routes) {
    const result = await lighthouse(`${origin}${route}`, {
      port: chrome.port,
      logLevel: "error",
      output: "json",
      onlyCategories: Object.keys(budgets),
    });
    if (!result) throw new Error(`Lighthouse returned no result for ${route}.`);

    const scores = Object.fromEntries(
      Object.entries(budgets).map(([category, minimum]) => {
        const score = result.lhr.categories[category]?.score ?? 0;
        if (score < minimum) failures.push(`${route} ${category}: ${score} < ${minimum}`);
        return [category, Math.round(score * 100)];
      }),
    );
    console.log(`${route} ${JSON.stringify(scores)}`);
  }

  if (failures.length) throw new Error(`Lighthouse budgets failed:\n${failures.join("\n")}`);
} catch (error) {
  if (server.exitCode !== null) {
    console.error(serverOutput.trim());
  }
  throw error;
} finally {
  await chrome?.kill();
  stopServer(server);
}
