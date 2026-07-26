const fs = require('fs');
const en = JSON.parse(fs.readFileSync('src/i18n/en.json', 'utf8'));
const zh = JSON.parse(fs.readFileSync('src/i18n/zh.json', 'utf8'));

function flatten(obj, prefix) {
  let result = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && !Array.isArray(v)) {
      result = result.concat(flatten(v, key));
    } else {
      result.push(key);
    }
  }
  return result;
}

const enKeys = new Set(flatten(en, ''));
const zhKeys = new Set(flatten(zh, ''));

const enOnly = [...enKeys].filter(k => !zhKeys.has(k));
const zhOnly = [...zhKeys].filter(k => !enKeys.has(k));

if (enOnly.length > 0) { console.log('=== Keys in en.json but not in zh.json ==='); enOnly.forEach(k => console.log(`  ${k}`)); }
if (zhOnly.length > 0) { console.log('=== Keys in zh.json but not in en.json ==='); zhOnly.forEach(k => console.log(`  ${k}`)); }
if (enOnly.length === 0 && zhOnly.length === 0) console.log('i18n keys are in sync!');
