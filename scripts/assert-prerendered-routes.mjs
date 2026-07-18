import { readFile } from "node:fs/promises";

const manifestPath = new URL("../.next/prerender-manifest.json", import.meta.url);
const publicRoutes = ["/", "/about", "/login", "/map", "/privacy", "/signup", "/submit", "/terms"];
const privateRoutes = ["/account", "/admin"];

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {
  throw new Error("Missing .next/prerender-manifest.json. Run `npm run build` first.");
}

const prerendered = new Set(Object.keys(manifest.routes ?? {}));
const missing = publicRoutes.filter((route) => !prerendered.has(route));
const leaked = privateRoutes.filter((route) => prerendered.has(route));

if (missing.length || leaked.length) {
  const failures = [
    missing.length ? `expected static routes missing: ${missing.join(", ")}` : null,
    leaked.length ? `private routes unexpectedly prerendered: ${leaked.join(", ")}` : null,
  ].filter(Boolean);
  throw new Error(failures.join("; "));
}

console.log(`Architecture check passed: ${publicRoutes.length} public routes are prerendered; private routes remain dynamic.`);
