/* ============================== the air: planes that actually use the airfields ============================== */
// A plane waits on the apron, taxis out, rolls down the runway, lifts off (its shadow falling away beneath
// it), flies to another airfield or away over the edge of the world, and comes back down the same way.
// Runways run along the tile's x axis: from u = -0.45 to +0.45, at v = 0.08.

const RWY_V = .08;
const airfields = () => builtOf('airfield');
function planeKind() { return hasTech('hover') ? 'liner' : hasTech('computing') ? 'jet' : 'prop'; }
const afZ = B => landZ(idx(B.x, B.y));
const CRUISE = 78;

function stepPlanes(dt) {
  if (!S || !hasTech('flight')) return;
  const afs = airfields(); if (!afs.length) { DYN.planes.length = 0; return; }
  const sun = LIGHT.sun || { hr: 13, fixed: 1 }, night = !sun.fixed && (sun.hr >= 23 || sun.hr < 5.5);
  for (const B of afs) {
    const a = DYN.af[B.id] = DYN.af[B.id] || { next: DYN.t + rf(8, 30), parked: 1 };
    if (DYN.t > a.next && a.parked && DYN.planes.length < 6) { // departure
      a.next = DYN.t + (night ? rf(160, 280) : rf(50, 110)); a.parked = 0;
      const others = afs.filter(o => o !== B), to = others.length && chance(.7) ? pick(others) : null;
      DYN.planes.push({ kind: planeKind(), st: 'taxi', from: B.id, to: to ? to.id : 0, x: B.x - .05, y: B.y - .24, z: afZ(B), h: Math.PI, spd: 0, t: 0, col: pick(['#e05b52', '#3f7fb0', '#e0a43a', '#4e9a6a']), id: rnd() });
    }
  }
  // now and then someone flies in from far away
  if (DYN.t > (DYN.nextArr || 0)) {
    DYN.nextArr = DYN.t + (night ? rf(200, 320) : rf(70, 140));
    const B = pick(afs), a = DYN.af[B.id];
    if (a && a.parked && DYN.planes.length < 6 && !DYN.planes.some(p => p.to === B.id)) {
      const ang = rnd() * TAU, R = 46, x = B.x + Math.cos(ang) * R, y = B.y + Math.sin(ang) * R;
      DYN.planes.push({ kind: planeKind(), st: 'cruise', from: 0, to: B.id, x, y, z: afZ(B) + CRUISE, h: ang + Math.PI, spd: 1.7, t: 0, col: pick(['#e05b52', '#3f7fb0', '#e0a43a', '#4e9a6a']), id: rnd(), fadeIn: 1 });
    }
  }
  for (const p of DYN.planes) flyPlane(p, dt);
  DYN.planes = DYN.planes.filter(p => !p.gone);
}
function turnTo(p, want, rate, dt) { let d = ((want - p.h + Math.PI * 3) % TAU) - Math.PI; p.h += clamp(d, -rate * dt, rate * dt); return Math.abs(d); }
function flyPlane(p, dt) {
  const A = S.B[p.from], B = S.B[p.to];
  p.t += dt;
  switch (p.st) {
    case 'taxi': { // out to the end of the runway
      if (!A) { p.gone = 1; return; }
      const tx = A.x - .44, ty = A.y + RWY_V, d = Math.hypot(tx - p.x, ty - p.y);
      turnTo(p, Math.atan2(ty - p.y, tx - p.x), 3, dt);
      if (d < .03) { p.st = 'line'; break; }
      const s = Math.min(d, dt * .12); p.x += Math.cos(p.h) * s; p.y += Math.sin(p.h) * s; break;
    }
    case 'line': if (turnTo(p, 0, 2, dt) < .02) { p.h = 0; p.st = 'roll'; } break; // lined up
    case 'roll': { // down the runway and up
      p.spd = Math.min(1.9, p.spd + dt * .9); p.x += p.spd * dt; p.y = A.y + RWY_V;
      if (p.x > A.x + .2) { p.z += (p.spd * 16) * dt; }
      if (p.x > A.x + 1.2) p.st = 'climb';
      if (DYN.af[p.from] && p.x > A.x + .6) DYN.af[p.from].free = 1;
      break;
    }
    case 'climb': case 'cruise': {
      const base = B ? afZ(B) : A ? afZ(A) : 30;
      p.z = Math.min(base + CRUISE, p.z + dt * 16);
      if (p.fadeIn) p.fadeIn = Math.max(0, p.fadeIn - dt * .4);
      if (B) {
        const fx = B.x - 5.5, fy = B.y + RWY_V, d = Math.hypot(fx - p.x, fy - p.y);
        turnTo(p, Math.atan2(fy - p.y, fx - p.x), .55, dt);
        if (d < .9) { p.st = 'final'; p.fz = p.z; }
      } else { // away over the edge of the world
        if (p.st === 'climb') { p.away = p.away != null ? p.away : p.h + rf(-1.2, 1.2); }
        turnTo(p, p.away, .35, dt);
        if (p.x < -12 || p.y < -12 || p.x > W + 12 || p.y > H + 12) p.gone = 1;
        p.fade = clamp(Math.min(p.x + 12, p.y + 12, W + 12 - p.x, H + 12 - p.y) / 8, 0, 1);
      }
      p.st = p.st === 'final' ? 'final' : 'cruise';
      p.spd = Math.min(1.8, p.spd + dt * .3);
      p.x += Math.cos(p.h) * p.spd * dt; p.y += Math.sin(p.h) * p.spd * dt;
      break;
    }
    case 'final': { // lined up with the runway, coming down
      if (!B) { p.gone = 1; return; }
      turnTo(p, 0, 1.5, dt); p.y += (B.y + RWY_V - p.y) * Math.min(1, dt * 1.2);
      p.spd = Math.max(1.1, p.spd - dt * .15); p.x += Math.cos(p.h) * p.spd * dt;
      const k = clamp((p.x - (B.x - 5.5)) / (5.5 - .35), 0, 1);
      p.z = lerp(p.fz, afZ(B), smooth(k));
      if (k >= 1) { p.st = 'land'; p.z = afZ(B); p.h = 0; }
      break;
    }
    case 'land': { // brakes, then off the runway to the apron
      p.spd = Math.max(.12, p.spd - dt * 1.1); p.x += p.spd * dt; p.y = B.y + RWY_V;
      if (p.x > B.x + .28) { p.st = 'park'; }
      break;
    }
    case 'park': {
      const tx = B.x - .05, ty = B.y - .24, d = Math.hypot(tx - p.x, ty - p.y);
      turnTo(p, d > .05 ? Math.atan2(ty - p.y, tx - p.x) : Math.PI, 3, dt);
      if (d > .03) { const s = Math.min(d, dt * .12); p.x += Math.cos(p.h) * s; p.y += Math.sin(p.h) * s; }
      else { // parked: it takes the airfield's parking spot
        const a = DYN.af[B.id] = DYN.af[B.id] || {}; a.parked = 1; a.next = Math.max(a.next || 0, DYN.t + rf(40, 90)); p.gone = 1;
        if (p.from && S.B[p.from] && !S.flags.firstFlight) { const TA = S.T[S.B[p.from].sid], TB = S.T[B.sid]; if (TA && TB && TA !== TB) { S.flags.firstFlight = 1; chron('✈️', `The first airliner flies from ${TA.name} to ${TB.name}. Nineteen passengers, one very nervous pilot, and a round of applause on landing.`, { x: B.x, y: B.y, k: 'major', cap: 'The first flight' }); } }
      }
      break;
    }
  }
}
// where it is: grid x, y and absolute height
const planeAir = p => p.st === 'climb' || p.st === 'cruise' || p.st === 'final' || (p.st === 'roll' && p.z > (S.B[p.from] ? afZ(S.B[p.from]) + 10 : 99));

function drawPlane(c, p, dl, groundOnly) {
  const gi = idx(clamp(Math.round(p.x), 0, W - 1), clamp(Math.round(p.y), 0, H - 1)), gz = landZ(gi);
  const [x, y] = gridToWorld(p.x, p.y, p.z), al = (p.fade != null ? p.fade : 1) * (1 - (p.fadeIn || 0));
  if (al <= .01) return;
  const fx = Math.cos(p.h), fy = Math.sin(p.h), P = orient(x, y, fx, fy), s = p.kind === 'prop' ? 1 : p.kind === 'jet' ? 1.35 : 1.55;
  // shadow on the ground, falling away as it climbs
  const hgt = Math.max(0, p.z - gz);
  if (LT.shA > 0 && hgt < 140) {
    const [sx, sy] = gridToWorld(p.x + LT.shdx * hgt / 30, p.y + LT.shdy * hgt / 30, gz), Sp = orient(sx, sy, fx, fy);
    c.globalAlpha = al * clamp(.3 - hgt / 500, .06, .3); c.fillStyle = '#28324a';
    c.beginPath(); for (const [a, b] of [[.26 * s, 0], [-.22 * s, -.03 * s], [-.02 * s, -.24 * s], [-.08 * s, -.24 * s], [-.12 * s, 0], [-.08 * s, .24 * s], [-.02 * s, .24 * s], [-.22 * s, .03 * s]]) { const q = Sp(a, b, 0); c.lineTo(q[0], q[1]); } c.closePath(); c.fill();
  }
  if (groundOnly) { c.globalAlpha = 1; return; }
  c.globalAlpha = al;
  const body = p.kind === 'liner' ? '#f4f7fa' : '#f7f6f2', L = .26 * s, Bf = .028 * s;
  // wings first (under the fuselage)
  const sw = p.kind === 'prop' ? 0 : .07 * s, span = .24 * s;
  poly(c, [P(.05 * s, -Bf, 1.2), P(.05 * s - sw, -span, 1.2), P(-.02 * s - sw, -span, 1.2), P(-.03 * s, -Bf, 1.2)], topC(shade(body, LT.fT * .96)));
  poly(c, [P(.05 * s, Bf, 1.2), P(.05 * s - sw, span, 1.2), P(-.02 * s - sw, span, 1.2), P(-.03 * s, Bf, 1.2)], topC(shade(body, LT.fT * .96)));
  if (p.kind !== 'prop') for (const b of [-.11 * s, .11 * s]) prism(c, P, fx, fy, [[.04 * s, b - .015], [.04 * s, b + .015], [-.03 * s, b + .015], [-.03 * s, b - .015]], -.4, 1, '#c9ced6', '#dfe3e8');
  prism(c, P, fx, fy, [[L, 0], [L * .8, Bf], [-L, Bf * .6], [-L, -Bf * .6], [L * .8, -Bf]], 0, 2.4, body, body); // fuselage
  // tailplane and fin
  poly(c, [P(-L * .8, -.08 * s, 2), P(-L * .8, .08 * s, 2), P(-L, .08 * s, 2), P(-L, -.08 * s, 2)], topC(shade(body, LT.fT * .94)));
  const f0 = P(-L * .7, 0, 2.4), f1 = P(-L, 0, 2.4), f2 = P(-L * .98, 0, 7 * s), f3 = P(-L * .85, 0, 6.2 * s);
  poly(c, [f0, f1, f2, f3], p.col);
  // a stripe of colour along the side
  const st = P(L * .6, 0, 1.4), en = P(-L * .7, 0, 1.4); c.strokeStyle = p.col; c.lineWidth = .6 * s; c.beginPath(); c.moveTo(st[0], st[1]); c.lineTo(en[0], en[1]); c.stroke();
  if (p.kind === 'prop') { const [nx, ny] = P(L + .01, 0, 1.2); c.fillStyle = 'rgba(80,80,90,.35)'; c.beginPath(); c.ellipse(nx, ny, 2.4 * s, 1.1 * s, 0, 0, TAU); c.fill(); }
  if (p.kind === 'liner') { const [gx, gy] = P(-L, 0, 1.2); dl(gx, gy, 5, '#9ff0ea', .8); }
  // lights: red to port, green to starboard, a white strobe at the tail
  const [lx, ly] = P(-.02 * s - sw, -span, 1.4), [rx2, ry2] = P(-.02 * s - sw, span, 1.4);
  if (LIGHT.emK > .02) { circ(c, lx, ly, .5, '#ff4d4d'); circ(c, rx2, ry2, .5, '#5dff8a'); dl(lx, ly, 3.5, '#ff4d4d', .9); dl(rx2, ry2, 3.5, '#5dff8a', .9); }
  if ((p.t * 1.1 + p.id) % 1 < .12) { const [tx, ty] = P(-L, 0, 7 * s); circ(c, tx, ty, .6, '#ffffff'); dl(tx, ty, 6, '#ffffff', .95); }
  if (p.st === 'land' || p.st === 'final' || p.st === 'roll') { const [hx, hy] = P(L, 0, 1); dl(hx + fx * 8, hy, 6, '#fff4d6', .7); }
  c.globalAlpha = 1;
}
// high planes go over everything, under the clouds
function drawPlanesAir(c) { for (const p of DYN.planes) if (planeAir(p)) drawPlane(c, p, dlight); }
