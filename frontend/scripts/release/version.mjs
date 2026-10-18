#!/usr/bin/env node
/**
 * Release Version Calculator & Bump Utility
 * Usage:
 *   node version.mjs next <buildNumber>   -> sets package.json to <base>-next.<N>
 *   node version.mjs stable               -> sets package.json to <base>
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const [mode, build] = process.argv.slice(2);
const base = pkg.version.replace(/-.*$/, '');

const fail = (m) => {
  console.error(`❌ ${m}`);
  process.exit(1);
};

const cmp = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
};

let latest = '0.0.0';
try {
  latest = execSync(`npm view ${pkg.name} dist-tags.latest`, { encoding: 'utf8' }).trim();
} catch {
  // If package is not yet published
}

if (cmp(base, latest) <= 0) {
  fail(`package.json base version (${base}) is not newer than npm latest (${latest}). Bump version in package.json first.`);
}

let targetVersion;
if (mode === 'next') {
  if (!/^\d+$/.test(build ?? '')) {
    fail('Mode "next" requires a numeric build number argument (e.g. github.run_number).');
  }
  targetVersion = `${base}-next.${build}`;
} else if (mode === 'stable') {
  targetVersion = base;
} else {
  fail(`Unknown mode "${mode}". Expected "next" or "stable".`);
}

execSync(`npm version ${targetVersion} --no-git-tag-version --allow-same-version`, {
  cwd: root,
  stdio: 'inherit',
});

console.log(`version=${targetVersion}`);
