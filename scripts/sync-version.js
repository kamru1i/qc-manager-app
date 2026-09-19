#!/usr/bin/env node
/**
 * Keeps the three version sources in lockstep.
 *
 * package.json            → release tag, latest.json "version", Android versionName
 * src-tauri/tauri.conf.json → installer filenames AND the version the running app reports
 * src-tauri/Cargo.toml      → Rust crate version
 *
 * If these drift, the updater compares a manifest version against a binary that reports a
 * different one and re-offers the same update forever. Nothing else in the repo syncs them.
 *
 *   node scripts/sync-version.js           copy package.json's version into the other two
 *   node scripts/sync-version.js 8.0.1     set all three to 8.0.1
 *   node scripts/sync-version.js --check   exit 1 if they disagree (used in CI)
 */
const fs = require('fs');
const path = require('path');

const PKG = 'package.json';
const CONF = path.join('src-tauri', 'tauri.conf.json');
const CARGO = path.join('src-tauri', 'Cargo.toml');

const read = (p) => fs.readFileSync(p, 'utf8');

const versionOf = {
  pkg: () => JSON.parse(read(PKG)).version,
  conf: () => JSON.parse(read(CONF)).version,
  cargo: () => {
    const m = read(CARGO).match(/^version\s*=\s*"([^"]+)"/m);
    if (!m) throw new Error(`no version field in ${CARGO}`);
    return m[1];
  },
};

function writeAll(version) {
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`"${version}" is not a valid semver version`);
  }

  const pkg = JSON.parse(read(PKG));
  pkg.version = version;
  fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');

  // Rewrite the raw text so the file's existing formatting survives.
  const conf = read(CONF).replace(/("version"\s*:\s*)"[^"]+"/, `$1"${version}"`);
  fs.writeFileSync(CONF, conf);

  const cargo = read(CARGO).replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${version}"`);
  fs.writeFileSync(CARGO, cargo);
}

const arg = process.argv[2];

if (arg === '--check') {
  const found = { [PKG]: versionOf.pkg(), [CONF]: versionOf.conf(), [CARGO]: versionOf.cargo() };
  const unique = [...new Set(Object.values(found))];
  if (unique.length !== 1) {
    console.error('✗ version mismatch — a release built from this tree would loop the updater:');
    for (const [file, v] of Object.entries(found)) console.error(`    ${v.padEnd(12)} ${file}`);
    console.error('\n  Fix with:  npm run version:sync');
    process.exit(1);
  }
  console.log(`✓ all three version sources agree: ${unique[0]}`);
  process.exit(0);
}

const target = arg && !arg.startsWith('-') ? arg.replace(/^v/, '') : versionOf.pkg();
writeAll(target);
console.log(`✓ version set to ${target} in:\n    ${PKG}\n    ${CONF}\n    ${CARGO}`);
