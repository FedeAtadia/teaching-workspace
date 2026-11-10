// Renders the install icons (INSTALL-1) from src/app/icon.svg into public/icons/
// and src/app/apple-icon.png. Run again after changing the logo:
//   node scripts/make-icons.mjs
// sharp comes with Next.js; it is not a dependency of its own.
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const repo = join(import.meta.dirname, "..");
const sharp = createRequire(join(repo, "package.json"))("sharp");
const svg = readFileSync(join(repo, "src/app/icon.svg"), "utf8");

const open = svg.match(/<svg[^>]*>/)[0];
const inner = svg
  .slice(svg.indexOf(open) + open.length, svg.lastIndexOf("</svg>"))
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<rect[^>]*\/>/, "");
const defs = inner.match(/<defs>[\s\S]*?<\/defs>/)[0];
const mark = inner.replace(defs, "");

const VB = "163 103 1840 1840";
const C = [1083, 1023]; // centre of the viewBox
const BG = "#0B171B";
const page = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB}">${defs}${body}</svg>`;
const scaled = (s) => `<g transform="translate(${C[0]} ${C[1]}) scale(${s}) translate(${-C[0]} ${-C[1]})">${mark}</g>`;
const square = `<rect x="163" y="103" width="1840" height="1840" fill="${BG}"/>`;
const rounded = `<rect x="163" y="103" width="1840" height="1840" rx="400" fill="${BG}"/>`;

const out = join(repo, "public/icons");
mkdirSync(out, { recursive: true });
const render = (body, size, file) =>
  sharp(Buffer.from(page(body)), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file);

await Promise.all([
  // "any": the favicon's rounded square, transparent corners.
  render(rounded + scaled(0.86), 192, join(out, "icon-192.png")),
  render(rounded + scaled(0.86), 512, join(out, "icon-512.png")),
  // "maskable": full bleed; the mark inside the central safe circle (80%).
  render(square + scaled(0.62), 512, join(out, "icon-maskable-512.png")),
  // iOS rounds the corners itself and wants no transparency.
  render(square + scaled(0.78), 180, join(repo, "src/app/apple-icon.png")),
]);
console.log("Icons written.");
