// Builds the standalone Palmprint widget bundle.
//   1. Tailwind v4 CLI compiles widget-bundle/input.css → .cache/widget.css.
//   2. esbuild bundles entry.tsx (which imports the CSS as a text string)
//      into public/dist/palmprint-widget.js as an IIFE.

import { execSync } from "node:child_process";
import esbuild from "esbuild";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT_DIR = `${ROOT}public/dist`;
const PACKAGE_OUT_DIR = `${ROOT}packages/widget/dist`;
const CACHE_DIR = `${ROOT}widget-bundle/.cache`;
const CSS_OUT = `${CACHE_DIR}/widget.css`;

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PACKAGE_OUT_DIR, { recursive: true });
mkdirSync(CACHE_DIR, { recursive: true });

console.log("→ Compiling Tailwind CSS for the widget…");
execSync(
  `npx --yes @tailwindcss/cli -i widget-bundle/input.css -o ${CSS_OUT} --minify`,
  { cwd: ROOT, stdio: "inherit" },
);
if (!existsSync(CSS_OUT)) {
  throw new Error("Tailwind CSS build did not produce an output file.");
}
const cssBytes = statSync(CSS_OUT).size;

console.log("→ Bundling JS with esbuild…");
const out = `${OUT_DIR}/palmprint-widget.js`;
await esbuild.build({
  entryPoints: [`${ROOT}widget-bundle/entry.tsx`],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: out,
  loader: { ".css": "text" },
  define: { "process.env.NODE_ENV": '"production"' },
  jsx: "automatic",
  legalComments: "none",
  logLevel: "info",
});

const raw = readFileSync(out);
const gz = gzipSync(raw);
const fmt = (n) => `${(n / 1024).toFixed(1)} KB`;
const stats = `\
=== palmprint-widget.js ===
  raw:        ${fmt(raw.length)}
  gzipped:    ${fmt(gz.length)}
  css inline: ${fmt(cssBytes)} (already counted in raw)
`;
console.log("\n" + stats);
writeFileSync(`${OUT_DIR}/SIZE.txt`, stats);
copyFileSync(out, `${PACKAGE_OUT_DIR}/palmprint-widget.js`);
writeFileSync(`${PACKAGE_OUT_DIR}/SIZE.txt`, stats);
