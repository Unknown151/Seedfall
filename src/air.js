/* ============================== the air: planes that actually use the airfields ============================== */
// A plane waits on the apron, taxis out, rolls down the runway, lifts off (its shadow falling away beneath
// it), flies to another airfield or away over the edge of the world, and comes back down the same way.
// Runways run along x: on a one-tile field from u = -0.45 to +0.45 at v = 0.08; on its 4×2 lot (sim.js FP_BIG) down the
// whole length of the lot's back row, the terminal and the apron in front (afGeo).

const RWY_V = .08;
function afGeo(B) { // the runway's ends (x0, x1) and line (y), and the apron where a plane waits (px, py)
  if (fpW(B) >= 3) { const x0 = B.x - .42, x1 = B.x + fpW(B) - .58; return { x0, x1, y: B.y + fpH(B) - 1 + .08, px: B.x + .9, py: B.y + .02, L: x1 - x0 }; }
  return { x0: B.x - .44, x1: B.x + .45, y: B.y + RWY_V, px: B.x - .05, py: B.y - .24, L: .89 };
}
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
    if (a.parked) { const g = afGeo(B); a.pp = a.pp || { kind: planeKind(), x: g.px, y: g.py, h: Math.PI, t: 0, col: pick(['#e05b52', '#3f7fb0', '#e0a43a', '#4e9a6a']), id: rnd() }; a.pp.z = afZ(B); a.pp.kind = planeKind(); a.pp.x = g.px; a.pp.y = g.py; } // the plane waiting on the apron
    if (DYN.t > a.next && a.parked && DYN.planes.length < 6) { // departure
      a.next = DYN.t + (night ? rf(160, 280) : rf(50, 110)); a.parked = 0;
      const others = afs.filter(o => o !== B), to = others.length && chance(.7) ? pick(others) : null;
      const g = afGeo(B); DYN.planes.push({ kind: planeKind(), st: 'taxi', from: B.id, to: to ? to.id : 0, x: g.px, y: g.py, z: afZ(B), h: Math.PI, spd: 0, t: 0, col: pick(['#e05b52', '#3f7fb0', '#e0a43a', '#4e9a6a']), id: rnd() });
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
      const g = afGeo(A), tx = g.x0, ty = g.y, d = Math.hypot(tx - p.x, ty - p.y);
      turnTo(p, Math.atan2(ty - p.y, tx - p.x), 3, dt);
      if (d < .03) { p.st = 'line'; break; }
      const s = Math.min(d, dt * .12); p.x += Math.cos(p.h) * s; p.y += Math.sin(p.h) * s; break;
    }
    case 'line': if (turnTo(p, 0, 2, dt) < .02) { p.h = 0; p.st = 'roll'; } break; // lined up
    case 'roll': { // down the runway and up
      const g = afGeo(A); p.spd = Math.min(1.9, p.spd + dt * .9); p.x += p.spd * dt; p.y = g.y;
      if (p.x > g.x0 + g.L * .72) { p.z += (p.spd * 16) * dt; }
      if (p.x > g.x1 + .75) p.st = 'climb';
      if (DYN.af[p.from] && p.x > g.x0 + g.L * .8) DYN.af[p.from].free = 1;
      break;
    }
    case 'climb': case 'cruise': {
      const base = B ? afZ(B) : A ? afZ(A) : 30;
      p.z = Math.min(base + CRUISE, p.z + dt * 16);
      if (p.fadeIn) p.fadeIn = Math.max(0, p.fadeIn - dt * .4);
      if (B) {
        const g = afGeo(B), fx = g.x0 - 5.06, fy = g.y, d = Math.hypot(fx - p.x, fy - p.y);
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
      const g = afGeo(B); turnTo(p, 0, 1.5, dt); p.y += (g.y - p.y) * Math.min(1, dt * 1.2);
      p.spd = Math.max(1.1, p.spd - dt * .15); p.x += Math.cos(p.h) * p.spd * dt;
      const k = clamp((p.x - (g.x0 - 5.06)) / 5.15, 0, 1);
      p.z = lerp(p.fz, afZ(B), smooth(k));
      if (k >= 1) { p.st = 'land'; p.z = afZ(B); p.h = 0; }
      break;
    }
    case 'land': { // brakes, then off the runway to the apron
      const g = afGeo(B); p.spd = Math.max(.12, p.spd - dt * 1.1); p.x += p.spd * dt; p.y = g.y;
      if (p.x > g.x0 + Math.min(g.L * .72, 1.6)) { p.st = 'park'; }
      break;
    }
    case 'park': {
      const g = afGeo(B), tx = g.px, ty = g.py, d = Math.hypot(tx - p.x, ty - p.y);
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

