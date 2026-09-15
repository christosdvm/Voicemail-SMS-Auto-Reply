import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skippedDirectories = new Set(['.git', 'node_modules', 'coverage']);
const forbiddenNames = new Set([
  '.clasp.json',
  '.env',
  'credentials.json',
  'client_secret.json',
]);
const forbiddenExtensions = new Set(['.mp3', '.mp4', '.m4a', '.wav', '.webm', '.ogg']);
const textExtensions = new Set([
  '.gs', '.js', '.mjs', '.json', '.md', '.txt', '.yml', '.yaml', '.svg',
  '.gitignore', '.claspignore', '.editorconfig', '.gitattributes',
]);
const secretRules = [
  ['private key block', new RegExp(['BEGIN', '(?:RSA |EC |OPENSSH )?PRIVATE', 'KEY'].join(' '))],
  ['OpenAI-style API key', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{30,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['authorization bearer value', /Authorization["']?\s*[:=]\s*["']Bearer\s+[A-Za-z0-9._~+\/-]{20,}/i],
];

const findings = [];
for (const file of await walk(projectRoot)) {
  const relative = path.relative(projectRoot, file).replaceAll(path.sep, '/');
  const basename = path.basename(file).toLowerCase();
  const extension = path.extname(file).toLowerCase();

  if (forbiddenNames.has(basename) || forbiddenExtensions.has(extension)) {
    findings.push(`${relative}: private configuration or media file must not be committed`);
    continue;
  }
  if (!textExtensions.has(extension) && !textExtensions.has(basename)) continue;

  const contents = await readFile(file, 'utf8');
  for (const [label, pattern] of secretRules) {
    if (pattern.test(contents)) findings.push(`${relative}: possible ${label}`);
  }
}

if (findings.length > 0) {
  console.error('Public-safety check failed:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log('Public-safety check passed: no committed secrets or private media patterns found.');

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}
