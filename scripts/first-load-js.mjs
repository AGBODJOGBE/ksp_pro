// @ts-check
/**
 * Poids du JavaScript chargé à la première visite de chaque page (« First Load JS »), mesuré sur le build.
 *
 * Next.js 16 n'affiche plus ce chiffre à la fin de `next build`. Ce script le recalcule à partir des
 * pages statiques générées (`.next/server/app/**.html`) : il additionne la taille compressée (gzip) des
 * fichiers `/_next/static/**.js` appelés par chaque page. Usage : `pnpm build && pnpm size`.
 *
 * Les pages rendues à la demande (ƒ) n'ont pas de HTML dans le build : elles n'apparaissent pas ici.
 *
 * Espace pro : budget de 200 Ko par écran (3G de terrain, docs/architecture.md). Une page au-dessus du
 * budget est signalée et le script sort en erreur (code 1), ce qui arrête la CI.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const NEXT_DIR = '.next';
const APP_DIR = join(NEXT_DIR, 'server', 'app');
const SCRIPT_SRC = /<script[^>]*\ssrc="\/_next\/(static\/[^"?]+\.js)/g;
/** Budget par écran, en Ko compressés. */
const BUDGET_KB = 200;

/** @param {string} dir @returns {string[]} */
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

/** `(legal)/mentions-legales.html` → `/mentions-legales` ; `index.html` → `/`. */
/** @param {string} file */
function routeOf(file) {
  const segments = relative(APP_DIR, file)
    .replace(/\.html$/, '')
    .split(sep)
    .filter((segment) => !/^\(.*\)$/.test(segment));
  const path = segments.join('/').replace(/(^|\/)index$/, '');
  return `/${path}`;
}

/** @type {Map<string, number>} */
const gzipCache = new Map();
/** @param {string} asset */
function gzipSize(asset) {
  const cached = gzipCache.get(asset);
  if (cached !== undefined) return cached;
  const size = gzipSync(readFileSync(join(NEXT_DIR, asset))).length;
  gzipCache.set(asset, size);
  return size;
}

const rows = htmlFiles(APP_DIR)
  .filter((file) => !file.includes('_global-error'))
  .map((file) => {
    const html = readFileSync(file, 'utf8');
    const assets = new Set([...html.matchAll(SCRIPT_SRC)].map((match) => match[1] ?? ''));
    const bytes = [...assets].reduce((total, asset) => total + gzipSize(asset), 0);
    return { route: routeOf(file), kb: bytes / 1024, files: assets.size };
  })
  .sort((a, b) => a.route.localeCompare(b.route));

const width = Math.max(...rows.map((row) => row.route.length), 'Page'.length);
const over = rows.filter((row) => row.kb > BUDGET_KB);
const lines = [
  `${'Page'.padEnd(width)}  First Load JS (gzip)  Fichiers`,
  ...rows.map(
    (row) =>
      `${row.route.padEnd(width)}  ${`${row.kb.toFixed(1)} Ko`.padStart(20)}  ${String(row.files).padStart(8)}${row.kb > BUDGET_KB ? '  au-dessus du budget' : ''}`,
  ),
  '',
  over.length
    ? `${over.length} page(s) au-dessus du budget de ${BUDGET_KB} Ko.`
    : `Toutes les pages tiennent dans le budget de ${BUDGET_KB} Ko.`,
];
process.stdout.write(`${lines.join('\n')}\n`);
if (over.length) process.exitCode = 1;
