import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skippedDirectories = new Set(['.git', 'node_modules', 'coverage']);
const findings = [];

const files = await walk(projectRoot);
const markdownFiles = files.filter((file) => path.extname(file) === '.md');

for (const file of markdownFiles) {
  const contents = await readFile(file, 'utf8');
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of contents.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, '');
    if (/^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;

    const relativeTarget = rawTarget.split('#')[0];
    if (!relativeTarget) continue;

    let decodedTarget;
    try {
      decodedTarget = decodeURIComponent(relativeTarget);
    } catch (error) {
      findings.push(`${relative(file)}: invalid encoded link ${rawTarget}`);
      continue;
    }

    const resolvedTarget = path.resolve(path.dirname(file), decodedTarget);
    if (!resolvedTarget.startsWith(`${projectRoot}${path.sep}`)) {
      findings.push(`${relative(file)}: link leaves the repository: ${rawTarget}`);
      continue;
    }

    try {
      await access(resolvedTarget);
    } catch (error) {
      findings.push(`${relative(file)}: missing link target ${rawTarget}`);
    }
  }
}

for (const file of [
  'appsscript.json',
  'package.json',
  'config/example-script-properties.json',
]) {
  try {
    JSON.parse(await readFile(path.join(projectRoot, file), 'utf8'));
  } catch (error) {
    findings.push(`${file}: invalid JSON (${error.message})`);
  }
}

if (findings.length > 0) {
  console.error('Repository consistency check failed:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(
  `Repository consistency check passed: ${markdownFiles.length} Markdown files and 3 JSON files verified.`
);

function relative(file) {
  return path.relative(projectRoot, file).replaceAll(path.sep, '/');
}

async function walk(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await walk(target));
    else if (entry.isFile()) results.push(target);
  }
  return results;
}
