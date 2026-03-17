#!/usr/bin/env node
/**
 * Release script: bumps version, updates CHANGELOG, commits, tags, and pushes.
 * Usage: node scripts/release.js <version> [release-notes]
 * Example: node scripts/release.js 0.2.0 "Fixed update server connection errors"
 *
 * Requires: git, and GH_TOKEN secret in GitHub repo for the workflow to publish.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const version = process.argv[2];
const releaseNotes = process.argv[3] || 'See CHANGELOG.md';

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/release.js <version> [release-notes]');
  console.error('Example: node scripts/release.js 0.2.0 "Fixed bugs"');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const changelogPath = path.join(root, 'CHANGELOG.md');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const prevVersion = pkg.version;
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

let changelog = fs.readFileSync(changelogPath, 'utf-8');
const today = new Date().toISOString().slice(0, 10);
const newEntry = `## [${version}] - ${today}\n\n${releaseNotes}\n\n`;
changelog = changelog.replace(/(All notable changes to Mix Bridge will be documented in this file\.\n\n)/, `$1${newEntry}`);
fs.writeFileSync(changelogPath, changelog);

console.log(`Bumped ${prevVersion} -> ${version}`);

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
  } catch (e) {
    console.error(`Failed: ${cmd}`);
    process.exit(1);
  }
}

run('git add package.json CHANGELOG.md');
run(`git commit -m "Release v${version}"`);
run(`git tag -a "v${version}" -m "${releaseNotes.replace(/"/g, '\\"')}"`);
console.log('Pushing to origin...');
run('git push origin HEAD');
run(`git push origin "v${version}"`);
console.log(`Done. GitHub Actions will build and publish v${version}.`);
