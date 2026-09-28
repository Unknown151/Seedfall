// Sample textures made entirely in code (no image files): grass, brick, roof tiles, bark, leaves. Run from test/: `node texgen.mjs`
// Writes tex_<name>.png for each and tex_sheet.png with all of them side by side. Everything tiles seamlessly.
import { launch } from './env.mjs';
import fs from 'fs';
const b = await launch(); const p = await b.newPage();
const out = await p.evaluate(() => {
  const N = 512;
  // tileable value noise: a lattice that wraps, smoothly interpolated, summed over octaves
  const rng = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  function noise(seed, cells) { const r = rng(seed), g = new Float32Array(cells * cells).map(() => r()); return (x, y) => { x = x / N * cells; y = y / N * cells; const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), G = (i, j) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)]; return (G(x0, y0) * (1 - sx) + G(x0 + 1, y0) * sx) * (1 - sy) + (G(x0, y0 + 1) * (1 - sx) + G(x0 + 1, y0 + 1) * sx) * sy; }; }
  function fbm(seed, base, oct = 5) { const ns = [...Array(oct)].map((_, k) => noise(seed + k * 97, base << k)); return (x, y) => { let v = 0, a = .5, t = 0; for (const n of ns) { v += n(x, y) * a; t += a; a *= .5; } return v / t; }; }
  const cv = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
  const px = (fn) => { const c = cv(), g = c.getContext('2d'), im = g.createImageData(N, N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const [r, gg, bb] = fn(x, y), i = (y * N + x) * 4; im.data[i] = r; im.data[i + 1] = gg; im.data[i + 2] = bb; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); return c; };
  const mixc = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  // draw something on a tiling canvas: repeat it at the 8 wrap-around offsets so edges match
  const wrap = (g, f) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(dx, dy); f(); g.restore(); } };
  const R = rng(7);

  // 1. grass: mottled greens, dry and lush patches, then thousands of blades
  const gm = fbm(11, 4), gd = fbm(23, 3), gs = fbm(31, 16, 3);
  const grass = px((x, y) => { const m = gm(x, y), d = Math.max(0, gd(x, y) - .58) * 3, s = gs(x, y); let c = mixc([62, 104, 38], [118, 150, 58], m); c = mixc(c, [138, 128, 72], Math.min(.55, d)); return c.map(v => v * (.86 + s * .28)); });
  { const g = grass.getContext('2d'); for (let k = 0; k < 9000; k++) { const x = R() * N, y = R() * N, l = 3 + R() * 7, a = -Math.PI / 2 + (R() - .5) * .9, t = R(); const col = t < .5 ? `rgba(${40 + R() * 30},${80 + R() * 40},${24 + R() * 20},.55)` : `rgba(${120 + R() * 50},${160 + R() * 40},${60 + R() * 30},.45)`; wrap(g, () => { g.strokeStyle = col; g.lineWidth = .9 + R() * .6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }); }
    for (let k = 0; k < 60; k++) { const x = R() * N, y = R() * N, col = ['#f2f0e6', '#f3d24a', '#c9b3e0'][(R() * 3) | 0]; wrap(g, () => { g.fillStyle = col; for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(x + (R() - .5) * 8, y + (R() - .5) * 8, 1.3, 0, 7); g.fill(); } }); } }

  // 2. brick wall (running bond): each brick its own shade, mortar lines, grit, a little soot low down
  const bn = fbm(41, 32, 3), bs = fbm(43, 4), BW = 64, BH = 24;
  const bricks = [];
  for (let r = 0; r < N / BH; r++) for (let c = -1; c <= N / BW; c++) bricks.push({ r, c, t: R(), u: R() });
  const brick = px((x, y) => {
    const r = Math.floor(y / BH), off = r % 2 ? BW / 2 : 0, c = Math.floor((x + off) / BW), bx = (x + off) % BW, by = y % BH;
    const mort = bx < 3 || by < 3; const h = bricks.find(q => q.r === r && q.c === ((c % (N / BW)) + (N / BW)) % (N / BW)) || { t: .5, u: .5 };
    const grit = bn(x, y), edge = Math.min(bx, BW - bx, by, BH - by) < 6 ? .92 : 1;
    if (mort) return [180, 172, 158].map(v => v * (.85 + grit * .25));
    let col = mixc([146, 62, 42], [178, 92, 58], h.t); if (h.u > .88) col = mixc(col, [110, 60, 52], .6); if (h.u < .08) col = mixc(col, [196, 128, 88], .5);
    return col.map(v => v * edge * (.8 + grit * .35) * (1 - .12 * bs(x, y)));
  });

  // 3. roof tiles (clay pantiles): rows that overlap, each tile rounded, weathered, a few darker replacements
  const rn = fbm(51, 32, 3), rm = fbm(53, 3), TW = 42, TH = 34, tiles = [...Array(400)].map(() => R());
  const roof = px((x, y) => {
    const r = Math.floor(y / TH), off = r % 2 ? TW / 2 : 0, c = Math.floor((x + off) / TW), tx = ((x + off) % TW) / TW, ty = (y % TH) / TH;
    const t = tiles[(r * 13 + c * 7) % 400], round = Math.sin(tx * Math.PI), lip = ty > .82 ? .62 : 1, shade = .72 + .38 * round;
    let col = mixc([160, 72, 44], [190, 102, 60], t); if (t > .93) col = mixc(col, [98, 58, 46], .55);
    col = mixc(col, [120, 118, 96], Math.max(0, rm(x, y) - .6) * 1.4); // moss and weather
    return col.map(v => v * shade * lip * (.85 + rn(x, y) * .3) * (.78 + .22 * ty));
  });

  // 4. bark: long vertical plates with dark cracks between them, and a little lichen
  function noise2(seed, cx, cy) { const r = rng(seed), g = new Float32Array(cx * cy).map(() => r()); return (x, y) => { x = x / N * cx; y = y / N * cy; const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), G = (i, j) => g[((j % cy + cy) % cy) * cx + ((i % cx + cx) % cx)]; return (G(x0, y0) * (1 - sx) + G(x0 + 1, y0) * sx) * (1 - sy) + (G(x0, y0 + 1) * (1 - sx) + G(x0 + 1, y0 + 1) * sx) * sy; }; }
  const kA = noise2(61, 28, 4), kB = noise2(62, 56, 8), kC = noise2(63, 128, 40), kl = fbm(67, 6), kw = noise2(64, 4, 2), kCr = noise2(65, 20, 3);
  const bark = px((x, y) => {
    const wx = (x + kw(x, y) * 40 + N) % N, v = kA(wx, y) * .55 + kB(wx, y) * .3 + kC(wx, y) * .15; // stretched tall: plates run up the trunk
    const sm = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
    const cn = kCr(wx, y) * .7 + kB(wx, y) * .3, d = Math.abs(cn - .5), crack = 1 - sm(.012, .05, d), lip = sm(.05, .09, d) * (1 - sm(.09, .16, d)); // thin cracks along the contours, a raised lip beside them
    let c = mixc([70, 60, 52], [112, 98, 84], v); c = mixc(c, [134, 118, 100], lip * .5); c = mixc(c, [30, 24, 20], crack * .9);
    c = mixc(c, [120, 132, 100], Math.max(0, kl(x, y) - .64) * 2 * (1 - crack));
    const grain = .86 + R() * .22 * (1 - crack) + kC(x, y) * .1;
    return c.map(q => q * grain);
  });

  // 5. leaves: overlapping clusters of leaves, darker inside, sunlit on top
  const leaves = cv(); { const g = leaves.getContext('2d'); g.fillStyle = '#23401c'; g.fillRect(0, 0, N, N); const ln = fbm(71, 6);
    for (let k = 0; k < 2600; k++) { const x = R() * N, y = R() * N, s = 5 + R() * 7, a = R() * 7, v = ln(x, y) * .6 + R() * .4, col = `rgb(${34 + v * 90},${66 + v * 100},${26 + v * 40})`;
      wrap(g, () => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, s, s * .45, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(20,40,14,.35)'; g.lineWidth = .7; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke(); g.restore(); }); } }

  // a sheet: each texture tiled 2x2 so you can see it repeat seamlessly
  const names = [['Grass', grass], ['Brick wall', brick], ['Roof tiles', roof], ['Bark', bark], ['Leaves', leaves]];
  const sheet = document.createElement('canvas'); sheet.width = 5 * 420 + 60; sheet.height = 520; const s = sheet.getContext('2d');
  s.fillStyle = '#f4f1ea'; s.fillRect(0, 0, sheet.width, sheet.height); s.font = '600 22px system-ui'; s.fillStyle = '#2b2833';
  names.forEach(([n, c], k) => { const X = 20 + k * 420; s.fillText(n, X, 40); for (const dx of [0, 1]) for (const dy of [0, 1]) s.drawImage(c, X + dx * 200, 60 + dy * 200, 200, 200); s.fillStyle = '#6d6676'; s.font = '14px system-ui'; s.fillText('tiled 2×2, 512 px each', X, 490); s.fillStyle = '#2b2833'; s.font = '600 22px system-ui'; });
  return Object.fromEntries([...names.map(([n, c]) => [n.toLowerCase().replace(/ /g, '_'), c.toDataURL('image/png')]), ['sheet', sheet.toDataURL('image/png')]]);
});
for (const [k, v] of Object.entries(out)) fs.writeFileSync(`tex_${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
console.log('wrote', Object.keys(out).map(k => `tex_${k}.png`).join(', '));
await b.close();
