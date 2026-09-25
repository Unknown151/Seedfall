#!/bin/sh
cd /home/claude/seedfall
{ cat src/head.html; for f in util data world render buildings light sim streets econ people ai levers faith dyn agents sea air ui persist; do cat src/$f.js; echo; done; cat src/main.js; } > seedfall.html
node -e "
const s=require('fs').readFileSync('seedfall.html','utf8');
const js=s.slice(s.indexOf('<script>')+8, s.lastIndexOf('</script>'));
try{ new Function(js); console.log('syntax ok', (s.length/1024).toFixed(0)+'KB'); }catch(e){ console.log('SYNTAX ERROR', e.message); process.exit(1) }"
node -e "
const s=require('fs').readFileSync('seedfall.html','utf8'); const js=s.slice(s.indexOf('<script>')+8, s.lastIndexOf('</script>'));
const n={}; for (const m of js.matchAll(/^\s*function\s+([A-Za-z0-9_\$]+)\s*\(/gm)) n[m[1]]=(n[m[1]]||0)+1;
const d=Object.keys(n).filter(k=>n[k]>1); if (d.length) { console.log('DUPLICATE FUNCTIONS', d.join(', ')); process.exit(1); }"
