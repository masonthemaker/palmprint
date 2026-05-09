import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { build } from "esbuild";

const root = new URL("..", import.meta.url);

const external = [
  "@mediapipe/tasks-vision",
  "next",
  "react",
  "react-dom",
  "react-icons",
  "react-icons/pi",
];

const entries = [
  {
    pkg: "core",
    entry: "packages/core/src/index.ts",
    outfile: "packages/core/dist/index.js",
    platform: "neutral",
  },
  {
    pkg: "server",
    entry: "packages/server/src/index.ts",
    outfile: "packages/server/dist/index.js",
    platform: "node",
  },
  {
    pkg: "server",
    entry: "packages/server/src/next.ts",
    outfile: "packages/server/dist/next.js",
    platform: "node",
  },
  {
    pkg: "server",
    entry: "packages/server/src/next-route-handlers.ts",
    outfile: "packages/server/dist/next-route-handlers.js",
    platform: "node",
  },
  {
    pkg: "react",
    entry: "packages/react/src/index.ts",
    outfile: "packages/react/dist/index.js",
    platform: "browser",
    banner: { js: '"use client";' },
  },
];

for (const pkg of ["core", "server", "react"]) {
  rmSync(new URL(`packages/${pkg}/dist`, root), {
    recursive: true,
    force: true,
  });
  mkdirSync(new URL(`packages/${pkg}/dist`, root), { recursive: true });
}

for (const item of entries) {
  await build({
    entryPoints: [new URL(item.entry, root).pathname],
    outfile: new URL(item.outfile, root).pathname,
    bundle: true,
    format: "esm",
    platform: item.platform,
    target: "es2020",
    sourcemap: true,
    external,
    banner: item.banner,
  });
  console.log(`built ${item.outfile}`);
}

for (const pkg of ["core", "server", "react"]) {
  execFileSync(
    new URL("node_modules/.bin/tsc", root).pathname,
    ["-p", new URL(`packages/${pkg}/tsconfig.build.json`, root).pathname],
    { stdio: "inherit" },
  );
}
