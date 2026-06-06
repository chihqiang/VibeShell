import { readFileSync, writeFileSync } from 'fs';

const version = process.argv[2] || JSON.parse(readFileSync('package.json', 'utf8')).version;
const log = [];

// Update package.json when version explicitly provided
if (process.argv[2]) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const old = pkg.version;
  pkg.version = version;
  writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  log.push(`  package.json          ${old} → ${version}`);
}

// Update tauri.conf.json
const conf = readFileSync('src-tauri/tauri.conf.json', 'utf8');
const oldConf = conf.match(/"version"\s*:\s*"([^"]+)"/)?.[1] || '?';
writeFileSync('src-tauri/tauri.conf.json', conf.replace(/"version"\s*:\s*"[^"]+"/, `"version": "${version}"`));
log.push(`  tauri.conf.json       ${oldConf} → ${version}`);

// Update Cargo.toml
const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8');
const oldCargo = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1] || '?';
writeFileSync('src-tauri/Cargo.toml', cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`));
log.push(`  Cargo.toml            ${oldCargo} → ${version}`);

console.log(`\nVersion bumped to ${version}\n${log.join('\n')}\n`);
