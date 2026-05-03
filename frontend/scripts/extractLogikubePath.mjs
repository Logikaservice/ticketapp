import fs from 'fs';

const svg = fs.readFileSync(new URL('../src/assets/logikube-wordmark.svg', import.meta.url), 'utf8');
const m = svg.match(/<path\s+d="([^"]+)"/);
if (!m) throw new Error('path non trovato');
const d = m[1];

const out =
  `// Generato da scripts/extractLogikubePath.mjs (da src/assets/logikube-wordmark.svg)\n` +
  `export const LOGIKUBE_WORDMARK_PATH = ${JSON.stringify(d)};\n`;

fs.writeFileSync(new URL('../src/components/hub/logikubeWordmarkPath.js', import.meta.url), out);
console.log('Wrote logikubeWordmarkPath.js, length', d.length);
