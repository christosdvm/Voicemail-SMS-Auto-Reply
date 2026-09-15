import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(projectRoot, 'src');
const bundlePath = path.join(projectRoot, 'Code.gs');
const checkOnly = process.argv.includes('--check');

const sourceFiles = (await readdir(sourceDirectory))
  .filter((name) => name.endsWith('.gs'))
  .sort();

if (sourceFiles.length === 0) {
  throw new Error('No Apps Script source modules were found in src/.');
}

const modules = await Promise.all(
  sourceFiles.map(async (name) => {
    const contents = await readFile(path.join(sourceDirectory, name), 'utf8');
    return `// Source: src/${name}\n\n${contents.trim()}\n`;
  })
);

const banner = `/**
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 *
 * Edit the ordered modules in src/ and run \`npm run build\`.
 * Code.gs remains the copy-paste and clasp-compatible deployment artifact.
 */\n\n`;
const bundle = `${banner}${modules.join('\n')}`;

if (checkOnly) {
  const current = await readFile(bundlePath, 'utf8');
  if (current !== bundle) {
    console.error('Code.gs is out of date. Run npm run build and commit the result.');
    process.exitCode = 1;
  } else {
    console.log(`Code.gs matches ${sourceFiles.length} ordered source modules.`);
  }
} else {
  await writeFile(bundlePath, bundle, 'utf8');
  console.log(`Built Code.gs from ${sourceFiles.length} ordered source modules.`);
}
