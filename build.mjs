// Builds seedfall.html from src/ (same as build.sh, but runs anywhere Node does: `node build.mjs`)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ORDER = ['util', 'data', 'world', 'render', 'buildings', 'light', 'sim', 'streets', 'econ', 'people', 'ai', 'levers', 'faith', 'dyn', 'agents', 'sea', 'air', 'ui', 'persist'];
let out = fs.readFileSync(path.join(here, 'src/head.html'), 'utf8');
for (const f of ORDER) out += fs.readFileSync(path.join(here, 'src', f + '.js'), 'utf8') + '\n';
out += fs.readFileSync(path.join(here, 'src/main.js'), 'utf8');
fs.writeFileSync(path.join(here, 'seedfall.html'), out);
const js = out.slice(out.indexOf('<script>') + 8, out.lastIndexOf('</script>'));
try { new Function(js); } catch (e) { console.error('SYNTAX ERROR', e.message); process.exit(1); }
const n = {}; for (const m of js.matchAll(/^\s*function\s+([A-Za-z0-9_$]+)\s*\(/gm)) n[m[1]] = (n[m[1]] || 0) + 1;
const dup = Object.keys(n).filter(k => n[k] > 1);
if (dup.length) { console.error('DUPLICATE FUNCTIONS', dup.join(', ')); process.exit(1); }
if (process.argv.includes('--dist')) fs.copyFileSync(path.join(here, 'seedfall.html'), path.join(here, 'dist/Seedfall/seedfall.html'));
if (process.argv.includes('--public')) { fs.mkdirSync(path.join(here, 'public'), { recursive: true }); fs.copyFileSync(path.join(here, 'seedfall.html'), path.join(here, 'public/index.html')); } // what the Worker serves
console.log('syntax ok', (out.length / 1024).toFixed(0) + 'KB' + (process.argv.includes('--dist') ? ' (copied to dist/Seedfall)' : '') + (process.argv.includes('--public') ? ' (and public/index.html)' : ''));
