/* ============================== the world's moments in 3D: particles, nudges, the sky, things that fly and walk ============================== */
// Everything here is the view: it runs on Math.random (rf, pick... outside simRun) and GL3.t, is never saved, and never
// decides anything in the sim. Positions are world units: x and z are tile coordinates, y is height (height units * ZS).
//  - Particles (DYN.parts): smoke, mist, dust, rain, sparks, fire, lanterns. Drawn as point sprites in two passes:
//    soft ones blended (dimmed at night), glowing ones added on top and into the bloom mask.
//  - See-through triangles (glTr): the lighthouse beams, the zone view, the target under a nudge, lightning.
//  - Solid moving things (glFxDyn, from glPeople): rockets, supply pods under their parachutes, the landing pod, birds,
//    Longstriders, balloons, airships, planes, drones and shuttles crossing the sky, caravans, trade wagons, the helper
//    drone, and the diamonds over the people you know.
//  - The sky (comet, satellites, the station, the ring, shooting stars) is particles far off along a direction.
//  - Floating captions and map labels are HTML laid over the view, placed by projecting their spot (glOverlay).
const gGround = (x, y) => { const i = idx(clamp(Math.round(x), 0, W - 1), clamp(Math.round(y), 0, H - 1)); return Math.max(surfZ(i), M.water[i] ? SEAZ : -99) * ZS; };
function part3(x, y, z, vx, vy, vz, life, col, a, s, o) { // o: { g gravity, dr drag, gr growth a second, glow }
  const P = DYN.parts; if (P.length > 2400) return null;
  const p = { x, y, z, vx, vy, vz, life, age: 0, c: gcol(col), a, s, g: 0, dr: 0, gr: 0, glow: 0 }; if (o) Object.assign(p, o); P.push(p); return p;
}
const SMOKE3 = (x, y, z, col = '#e8e4df', a = .45, s = .18) => part3(x, y, z, rf(-.05, .05), rf(.25, .45), rf(-.05, .05), rf(3, 5), col, a, s, { dr: .4, gr: .35 });
function stepParts(dt) {
  const P = DYN.parts;
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.age += dt; if (p.age >= p.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
    p.vy -= p.g * dt; if (p.dr) { const k = Math.max(0, 1 - p.dr * dt); p.vx *= k; p.vy *= k; p.vz *= k; } if (p.wob) p.vx += Math.sin(p.age * .4 + p.wob) * .02 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.s += p.gr * dt;
    if (p.land && p.y < gGround(p.x, p.z)) { p.age = p.life; } }
}

/* ---------- the nudges and the sky: what happens each frame ---------- */
function stepFx3(dt) {
  stepParts(dt);
  const night = LIGHT.nightK || 0;
  for (const r of DYN.rains) { r.t += dt; const g = gGround(r.x, r.y), top = g + 4.2; // a dark cloud gathers, then rain falls out of it
    if (r.t < r.life - 2 && Math.random() < dt * 14) part3(r.x + rf(-2.4, 2.4), top + rf(-.3, .4), r.y + rf(-2.4, 2.4), rf(.05, .15), 0, rf(-.05, .05), rf(2.5, 3.5), rf(0, 1) < .5 ? '#9aa3b0' : '#b8bfc9', .5, rf(1, 1.6), { gr: .2 });
    if (r.t > 1.2 && r.t < r.life - 3) for (let k = 0; k < 40 * dt * 6; k++) part3(r.x + rf(-2.6, 2.6), top - .2, r.y + rf(-2.6, 2.6), -.3, -7, .2, .7, '#a9cbe0', .55, .035, { land: 1 }); }
  DYN.rains = DYN.rains.filter(r => r.t < r.life);
  if (DYN.fireworks) { for (const f of DYN.fireworks) { f.t += dt; f.next -= dt;
      if (f.next <= 0 && f.t < f.life - 1.5) { f.next = rf(.25, .7); const x = f.x + rf(-1.5, 1.5), z = f.y + rf(-1.5, 1.5), y = gGround(x, z) + rf(2, 3.8), col = pick(['#ff6b8b', '#ffd66b', '#7fe0ff', '#b98cff', '#8cffb0', '#ffffff']);
        for (let k = 0; k < 34; k++) { const a = Math.random() * TAU, b = Math.acos(rf(-1, 1)), s = rf(.8, 1.5); part3(x, y, z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s, rf(1, 1.8), col, 1, .07, { g: .9, dr: .8, glow: 1 }); } } }
    DYN.fireworks = DYN.fireworks.filter(f => f.t < f.life); }
  for (const d of DYN.drops) { d.t += dt; if (d.t > 4 && !d.hit) { d.hit = 1; const g = gGround(d.x, d.y); for (let k = 0; k < 36; k++) { const a = Math.random() * TAU, s = rf(.4, 1.2); part3(d.x, g + .05, d.y, Math.cos(a) * s, rf(.3, .9), Math.sin(a) * s, rf(.8, 1.8), '#d8c9b0', .7, .1, { g: 1.6, dr: 1.2, gr: .2 }); } } }
  DYN.drops = DYN.drops.filter(d => d.t < 9);
  for (const m of DYN.meteors) { m.t += dt; const g = gGround(m.x, m.y);
    if (m.t < 2.6) { const f = m.t / 2.6, x = m.x + 18 * (1 - f), y = g + 30 * (1 - f), z = m.y - 10 * (1 - f);
      for (let k = 0; k < 3; k++) part3(x + rf(-.1, .1), y + rf(-.1, .1), z + rf(-.1, .1), rf(-.2, .2) + 1, rf(-.2, .2) + 1.6, rf(-.2, .2) - .5, rf(.4, 1), pick(['#fff4c2', '#ffc46b', '#ff8a4a']), .9, rf(.08, .16), { glow: 1, dr: 1 }); }
    else if (!m.hit) { m.hit = 1; DYN.flash = .8; for (let k = 0; k < 90; k++) { const a = Math.random() * TAU, s = rf(.5, 2.4); part3(m.x, g + .1, m.y, Math.cos(a) * s, rf(.6, 2.2), Math.sin(a) * s, rf(1, 2.6), pick(['#b9a99a', '#ffe2a8', '#8f8175']), .85, rf(.06, .16), { g: 2.2, dr: .9, glow: k % 4 === 0 ? 1 : 0 }); } } }
  DYN.meteors = DYN.meteors.filter(m => m.t < 6);
  for (const r of DYN.rockets) { const B = S.B[r.bid]; if (!B) { r.done = 1; continue; } r.t += dt; if (r.t > 2) { r.v += dt * (r.seed ? 2.3 : 3.2); r.alt += r.v * dt; }
    const g = gGround(B.x, B.y) + (B.type === 'sealaunch' ? SL_DECK : 0), y = g + r.alt + .2;
    for (let k = 0; k < (r.t < 2 ? 3 : 6); k++) part3(B.x + rf(-.08, .08), y, B.y + rf(-.08, .08), rf(-.5, .5), r.t < 2 ? rf(.1, .4) : -rf(1, 3), rf(-.5, .5), rf(1.2, 3), r.t < 2 ? '#eeeae4' : pick(['#f2efe9', '#e4e0da', '#d9d4cf']), .55, rf(.2, .4), { dr: .8, gr: .5 });
    if (r.t > 2) part3(B.x, y - .1, B.y, rf(-.1, .1), -rf(2, 4), rf(-.1, .1), rf(.2, .45), pick(['#fff1c9', '#ffd28a', '#ff9a4a']), .9, rf(.12, .22), { glow: 1 });
    if (r.alt > 70 && !r.done) { r.done = 1; if (B.type === 'launchpad' || B.type === 'sealaunch') setTimeout(() => { if (S.B[r.bid]) { S.B[r.bid].rk = 1; markDirty(idx(B.x, B.y)); } }, 8000); } }
  DYN.rockets = DYN.rockets.filter(r => !r.done);
  for (const b of DYN.birds) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; }
  DYN.birds = DYN.birds.filter(b => b.t < b.life);
  for (const g of DYN.giants) { g.t += dt; g.fx += g.dx * g.spd * dt; g.fy += g.dy * g.spd * dt; }
  DYN.giants = DYN.giants.filter(g => g.fx > -4 && g.fx < W + 4);
  stepFlyers(dt);
  if (DYN.meteorShower > 0) { DYN.meteorShower -= dt; if (Math.random() < dt * 1.5 && night > .3) { const a = rf(0, TAU), e = rf(.4, .9); skyPart(a, e, 1.4, '#ffffff', .9, 2.2, [Math.cos(a + 1.6) * .5, -.25, Math.sin(a + 1.6) * .5]); } }
  if (DYN.comet) { DYN.comet.t += dt; if (DYN.comet.t > DYN.comet.life) DYN.comet = null; }
  if (DYN.bolt) { DYN.bolt.t += dt; if (DYN.bolt.t > .35) DYN.bolt = null; }
  // smoke and mist from the works that don't have chimney smoke (the climate engine, a launch pad after a launch), and the hot springs
  const e = GL3.eye; if (e && !FAST) {
    for (const B of DYN.anim || []) { if (B.type !== 'terraformer' && !((B.type === 'launchpad' || B.type === 'sealaunch') && B.rk) || Math.hypot(B.x - e[0], B.y - e[2]) > 40 || Math.random() > dt * 1.2) continue; const g = gGround(B.x, B.y);
      if (B.type === 'terraformer') part3(B.x + rf(-.2, .2), g + 3.2, B.y + rf(-.2, .2), rf(-.2, .2), rf(.2, .4), rf(-.2, .2), rf(5, 8), '#cfeff0', .35, .5, { dr: .3, gr: .4 });
      else SMOKE3(B.x + rf(-.2, .2), g + .2, B.y + rf(-.2, .2), '#f4f2ef', .35, .3); }
    for (const o of S.springs || []) if (Math.random() < dt * 1.4 && Math.hypot(o.x - e[0], o.y - e[2]) < 30) part3(o.x + rf(-.2, .2), gGround(o.x, o.y) + .05, o.y + rf(-.2, .2), rf(-.04, .04), rf(.15, .3), rf(-.04, .04), rf(3, 5), '#f4f7f7', .3, .2, { dr: .3, gr: .3 });
  }
}
function skyPart(az, el, life, col, a, px, v) { // something in the sky: far off in a direction (az round from north, el up), a steady size on screen
  const e = GL3.eye || [W / 2, 20, H / 2], D = 300, d = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)], s = px * D / (GL3.pxs || 600);
  return part3(e[0] + d[0] * D, e[1] + d[1] * D, e[2] + d[2] * D, (v ? v[0] : 0) * D, (v ? v[1] : 0) * D, (v ? v[2] : 0) * D, life, col, a, s, { glow: 1, sky: 1 });
}
// the sky's lasting things are drawn fresh each frame (not kept as particles): the ring, satellites, the station, a comet
function skyThings(add) {
  const t = GL3.t, n = LIGHT.nightK || 0, e = GL3.eye; if (!e) return;
  const at = (az, el, px, col, a) => { const D = 300, d = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)]; add(e[0] + d[0] * D, e[1] + d[1] * D, e[2] + d[2] * D, px * D / (GL3.pxs || 600), col, a); };
  if (S.sky.ring > 0) for (let k = 0; k < 90 * S.sky.ring; k++) { const f = k / 90, az = -1.6 + f * 3.2; at(az, .5 + Math.sin(f * Math.PI) * .55, 2.4, [1, 1, 1], .35 + .3 * n); }
  if (n > .2) for (let k = 0; k < S.sky.sats; k++) { const ph = ((t * (.012 + (k % 5) * .004) + k * .37) % 1.2) - .1; at(-1.5 + ph * 3, .35 + (k * .071) % .5, 2, [1, 1, 1], .9 * n); }
  if (S.sky.station) { const ph = ((t * .006) % 1.3) - .15; at(-1.4 + ph * 2.8, .6 + Math.sin(ph * 2) * .1, 4.5, [1, 1, 1], .4 + .55 * n); }
  if (DYN.comet) { const c = DYN.comet, a = Math.min(1, c.t / 5, (c.life - c.t) / 5) * (.35 + .65 * n); for (let k = 0; k < 18; k++) at(c.az + k * .012, c.el + k * .006, 5 - k * .22, [1, .98 - k * .01, .95], a * (1 - k / 19)); }
}
function stepFlyers(dt) { // the odd thing crossing the sky: balloons, airships, planes, drones, shuttles by era (real planes use the airfields)
  if (!DYN.nextFly) DYN.nextFly = DYN.t + rf(15, 35);
  if (DYN.t > DYN.nextFly && !DYN.intro) {
    DYN.nextFly = DYN.t + rf(25, 60) / (S.age && S.age.k === 'sky' ? 2 : 1);
    let kind = null;
    if (hasTech('hover')) kind = pick(['shuttle', 'drones', 'plane']);
    else if (hasTech('net')) kind = pick(['plane', 'drones']);
    else if (hasTech('flight')) kind = anycount('airfield') ? pick(['airship', 'airship', 'balloon']) : pick(['airship', 'plane', 'plane']);
    else if (hasTech('rail')) kind = chance(.3) ? 'balloon' : null;
    if (kind) { const a = rf(0, TAU), sp = { plane: 3, airship: .7, balloon: .3, drones: 1.4, shuttle: 3.6 }[kind], c = [W / 2, H / 2], R = W * .8;
      DYN.flyers.push({ kind, x: c[0] - Math.cos(a) * R, y: c[1] - Math.sin(a) * R, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, h: { plane: 9, airship: 6, balloon: 4.5, drones: 3.4, shuttle: 11 }[kind] + rf(-1, 1), t: 0, col: pick(['#e76f51', '#f2c14e', '#5fa8d3', '#e9dcc4']) }); }
  }
  for (const f of DYN.flyers) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; }
  DYN.flyers = DYN.flyers.filter(f => f.t < 4 || (f.x > -W * .9 && f.x < W * 1.9 && f.y > -H * .9 && f.y < H * 1.9));
}

/* ---------- the camera, for the sim and the panels ---------- */
// camLook: you asked to see somewhere (a chronicle line, a town): the camera goes there and stays a while.
// camHint: the world suggests a shot (a pod landing, a rocket going up): the film camera takes it when it's free.
// camFollow: you asked to follow someone.
function camLook(x, y, zoom) { if (!GL3.gl) return; GL3.follow = null; GL3.goto = [x, gGround(x, y), y]; if (zoom) GL3.cam.zoom = zoom; glTouch(); }
function camHint(x, y, cap, zoom) { if (!GL3.gl || FAST) return; GL3.hint = { x, y, cap: cap || '', zoom: zoom || 3, t: GL3.t }; }
function camFollow(pid) { const w = DYN.walkers.find(w => w.pid === pid); if (!w || !GL3.gl) return false; if (w.st === 'in') w.until = Math.min(w.until, DYN.t + 1.5); GL3.follow = w; GL3.userFollow = w; glTouch(); return true; }

/* ---------- the arrival: the pod comes down out of the sky ---------- */
function startIntro() { const L = S.landing; DYN.intro = { t: 0, x: L.x, y: L.y }; }
function stepIntro(dt) {
  const I = DYN.intro; if (!I) return;
  I.t += dt; const T0 = 5.5, g = gGround(I.x, I.y), cam = GL3.cam;
  if (I.t < T0) { const f = I.t / T0, e = f * f; I.p = [I.x - 14 * (1 - e), g + .3 + 22 * (1 - e), I.y - 8 * (1 - e)];
    for (let k = 0; k < 4; k++) part3(I.p[0] + rf(-.05, .05), I.p[1] + rf(-.05, .05), I.p[2], rf(-.4, .4) - 1.2, rf(-.2, .4) + 1.6, rf(-.4, .4) - .7, rf(.4, 1.1), pick(['#ffd28a', '#ff9d5c', '#fff1c9']), .95, rf(.12, .26), { glow: 1, dr: 1 });
    if (Math.random() < .5) SMOKE3(I.p[0], I.p[1] + .1, I.p[2], '#d9d4cf', .45, .25);
    if (GL3.gl) { cam.auto = false; GL3.goto = null; GL3.follow = null; const k = 1 - Math.exp(-dt * 2); cam.tx += (lerp(I.p[0], I.x, .55) - cam.tx) * k; cam.ty += (lerp(I.p[1], g, .6) - cam.ty) * k; cam.tz += (lerp(I.p[2], I.y, .55) - cam.tz) * k; cam.zoom += (lerp(9, 4, smooth(f)) - cam.zoom) * k; } }
  else if (!I.landed) { I.landed = 1; I.p = null; DYN.flash = 1;
    const pod = Object.values(S.B).find(B => B.type === 'pod'); if (pod) { pod.hid = 0; markDirty(idx(pod.x, pod.y)); }
    for (let k = 0; k < 80; k++) { const a = Math.random() * TAU, s = rf(.4, 1.6); part3(I.x, g + .05, I.y, Math.cos(a) * s, rf(.2, 1), Math.sin(a) * s, rf(1, 2.6), pick(['#cdb79a', '#b99f80', '#e8dccb']), .8, rf(.1, .22), { g: 1.2, dr: 1, gr: .2 }); } }
  else if (I.t > T0 + 2.5) { DYN.intro = null; S.flags.intro = 0; introChronicle(); if (GL3.gl) { cam.auto = GL3.film !== false; GL3.lastIn = performance.now() - (FILM_IDLE - 20) * 1000; } }
}

/* ---------- drawing: particles and see-through triangles (after the world, before the bloom) ---------- */
const GL_FXVS = `#version 300 es
layout(location=0) in vec4 aP; layout(location=1) in vec4 aC; layout(location=2) in float aG; uniform mat4 uVP; uniform float uPx, uMax, uDay; out vec4 vC; out float vG;
void main(){ gl_Position=uVP*vec4(aP.xyz,1.); gl_PointSize=clamp(aP.w*uPx/gl_Position.w,1.,uMax); vC=aC; vG=aG; if(aG<.5) vC.rgb*=uDay; }`;
const GL_FXFS = `#version 300 es
precision mediump float; in vec4 vC; in float vG; out vec4 o;
void main(){ vec2 d=gl_PointCoord-.5; float r=length(d)*2.; if(r>1.) discard; float a=vC.a*(vG>.5 ? (1.-r)*(1.-r) : 1.-smoothstep(.2,1.,r)); o=vec4(vC.rgb*(vG>.5 ? 1.+(1.-r)*.6 : 1.),a); }`;
const GL_TRVS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; out vec4 vC; void main(){ gl_Position=uVP*vec4(aP,1.); vC=aC; }`;
const GL_TRFS = `#version 300 es
precision mediump float; in vec4 vC; out vec4 o; void main(){ o=vC; }`;
function glFxInit(gl) { GL3.fxp = glProg(gl, GL_FXVS, GL_FXFS); GL3.fxB = gl.createBuffer(); GL3.trp = glProg(gl, GL_TRVS, GL_TRFS); GL3.trB = gl.createBuffer(); }
const FXA = { soft: new GLFBuf(), glow: new GLFBuf(), blend: new GLFBuf(), add: new GLFBuf() };
function glTr(list, a, b, c, col, al, al2 = al, al3 = al) { const L = FXA[list], C = gcol(col); for (const [p, q] of [[a, al], [b, al2], [c, al3]]) L.push(p[0], p[1], p[2], C[0], C[1], C[2], q, 0, 0, 0, 0, 0, 0); } // (13 floats a vertex: the reused buffer's shape; 7 are used)
function glFx(gl, VP, pxs, day) {
  GL3.pxs = pxs; const S1 = FXA.soft, S2 = FXA.glow; S1.length = S2.length = 0;
  const add = (L, x, y, z, s, c, a) => L.push(x, y, z, s, c[0], c[1], c[2], a, 0, 0, 0, 0, 0);
  for (const p of DYN.parts) { const f = p.age / p.life, a = p.a * Math.min(1, p.age * 6 + (p.sky ? 1 : 0)) * (p.glow ? 1 - f : (1 - f) * (1 - f * .4)); if (a < .01) continue; add(p.glow ? S2 : S1, p.x, p.y, p.z, p.s, p.c, a); }
  skyThings((x, y, z, s, c, a) => add(S2, x, y, z, s, c, a));
  glFxDecor(); // beams, overlays, lightning, the target
  const n1 = S1.length / 13, n2 = S2.length / 13, Q = GL3.fxp;
  for (let a = 0; a < 7; a++) gl.disableVertexAttribArray(a);
  gl.enable(gl.BLEND); gl.depthMask(false);
  if (n1 + n2) { gl.useProgram(Q.p); gl.uniformMatrix4fv(Q.u.uVP, false, VP); gl.uniform1f(Q.u.uPx, pxs); gl.uniform1f(Q.u.uMax, GL3.ptMax || 64); gl.uniform1f(Q.u.uDay, .3 + .7 * day);
    gl.bindBuffer(gl.ARRAY_BUFFER, GL3.fxB); gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
    for (const [L, n, glow] of [[S1, n1, 0], [S2, n2, 1]]) { if (!n) continue;
      gl.bufferData(gl.ARRAY_BUFFER, L.a.subarray(0, L.length), gl.STREAM_DRAW);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 52, 0); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 52, 16); gl.vertexAttrib1f(2, glow); // (glow is the same for the whole pass)
      if (glow) gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE); else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, n); }
    gl.disableVertexAttribArray(0); gl.disableVertexAttribArray(1); }
  const T = GL3.trp, B1 = FXA.blend, B2 = FXA.add;
  if (B1.length + B2.length) { gl.useProgram(T.p); gl.uniformMatrix4fv(T.u.uVP, false, VP); gl.bindBuffer(gl.ARRAY_BUFFER, GL3.trB); gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
    for (const [L, addv] of [[B1, 0], [B2, 1]]) { if (!L.length) continue;
      gl.bufferData(gl.ARRAY_BUFFER, L.a.subarray(0, L.length), gl.STREAM_DRAW); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 52, 0); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 52, 12);
      if (addv) gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE); else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.drawArrays(gl.TRIANGLES, 0, L.length / 13); }
    gl.disableVertexAttribArray(0); gl.disableVertexAttribArray(1); B1.length = B2.length = 0; }
  gl.depthMask(true); gl.disable(gl.BLEND);
}
const ZONE_RGB = {};
function glFxDecor() {
  const em = LIGHT.emK || 0;
  // lighthouse beams sweep round all night
  if (em > .02) for (const B of DYN.anim || []) { if (B.type !== 'lighthouse') continue;
    const L = [B.x, gGround(B.x, B.y) + LH_LAMP, B.y], a = GL3.t * .8 + B.id * 1.7, d = [Math.cos(a), 0, Math.sin(a)], s = [-d[2], 0, d[0]], R = 7, wd = .8;
    const E = (k, o) => [L[0] + d[0] * R * k + s[0] * o, L[1] - .25 * k, L[2] + d[2] * R * k + s[2] * o];
    glTr('add', L, E(1, -wd), E(1, wd), '#fff0c4', .45 * em, 0, 0); glTr('add', L, [E(1, 0)[0], E(1, 0)[1] - wd * .7, E(1, 0)[2]], [E(1, 0)[0], E(1, 0)[1] + wd * .7, E(1, 0)[2]], '#fff0c4', .3 * em, 0, 0);
    FXA.glow.push(L[0], L[1], L[2], .45, 1, .95, .8, .9 * em, 0, 0, 0, 0, 0); }
  // lightning: a jagged bolt from the cloud to the ground
  if (DYN.bolt) { const b = DYN.bolt, a = 1 - b.t / .35; for (let k = 1; k < b.pts.length; k++) { const p = b.pts[k - 1], q = b.pts[k], w = .06;
      glTr('add', [p[0] - w, p[1], p[2]], [q[0] - w, q[1], q[2]], [q[0] + w, q[1], q[2]], '#f2f6ff', a); glTr('add', [p[0] - w, p[1], p[2]], [q[0] + w, q[1], q[2]], [p[0] + w, p[1], p[2]], '#f2f6ff', a);
      glTr('add', [p[0], p[1], p[2] - w], [q[0], q[1], q[2] - w], [q[0], q[1], q[2] + w], '#f2f6ff', a); glTr('add', [p[0], p[1], p[2] - w], [q[0], q[1], q[2] + w], [p[0], p[1], p[2] + w], '#f2f6ff', a); } }
  // the zone view (Z): each quarter tinted on the ground, a firmer edge where one meets another
  if (UI.zones) { const e = GL3.eye || [0, 0, 0];
    for (let i = 0; i < W * H; i++) { const z = M.zone[i]; if (!z) continue; const x = i % W, y = (i / W) | 0; if (Math.hypot(x - e[0], y - e[2]) > 60) continue;
      const col = ZONE_RGB[z] || (ZONE_RGB[z] = '#' + ZONE_COL[z].split(',').map(v => (+v).toString(16).padStart(2, '0')).join('')), g = surfZ(i) * ZS + .03, P = (u, v) => [x + u, g, y + v];
      glTr('blend', P(-.5, -.5), P(.5, -.5), P(.5, .5), col, .33); glTr('blend', P(-.5, -.5), P(.5, .5), P(-.5, .5), col, .33);
      const diff = (dx, dy) => !inb(x + dx, y + dy) || M.zone[idx(x + dx, y + dy)] !== z, ln = (a, b, c, d) => { glTr('blend', a, b, c, col, .9); glTr('blend', a, c, d, col, .9); }, t = .06;
      if (diff(1, 0)) ln(P(.5 - t, -.5), P(.5, -.5), P(.5, .5), P(.5 - t, .5)); if (diff(-1, 0)) ln(P(-.5, -.5), P(-.5 + t, -.5), P(-.5 + t, .5), P(-.5, .5));
      if (diff(0, 1)) ln(P(-.5, .5 - t), P(.5, .5 - t), P(.5, .5), P(-.5, .5)); if (diff(0, -1)) ln(P(-.5, -.5), P(.5, -.5), P(.5, -.5 + t), P(-.5, -.5 + t)); } }
  // where a nudge will land: a ring round the tile (wider for the rain and the bloom)
  if (UI.tool && DYN.hover >= 0) { const i = DYN.hover, x = i % W, y = (i / W) | 0, r = UI.tool === 'rain' || UI.tool === 'bloom' ? 3.2 : .7, g = surfZ(i) * ZS + .05, n = 32;
    for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU, P = (an, rr) => [x + Math.cos(an) * rr, g, y + Math.sin(an) * rr];
      glTr('blend', P(a, r - .08), P(b, r - .08), P(b, r), '#d9774b', .95); glTr('blend', P(a, r - .08), P(b, r), P(a, r), '#d9774b', .95); glTr('blend', [x, g, y], P(a, r - .08), P(b, r - .08), '#d9774b', .12); } }
}

/* ---------- drawing: the solid things that move (called from glPeople) ---------- */
function glFxDyn() {
  const t = GL3.t, night = LIGHT.nightK || 0, lit = GL3.litNow; GLB.id = 0; GLB.ao = 1; GLB.mat = 0;
  const sv = [GLB.x, GLB.y, GLB.base]; GLB.x = GLB.y = GLB.base = 0;
  try {
    for (const r of DYN.rockets) { const B = S.B[r.bid]; if (!B) continue; const y = gGround(B.x, B.y) + (B.type === 'sealaunch' ? SL_DECK : 0) + r.alt, X = B.x, Z = B.y; // a rocket, or the seedship
      if (r.seed) { gBox([X, y, Z], [.16, 0, 0], [0, 0, .16], 2.3, '#f4f6f8'); gSpire([X, y + 2.3, Z], .16, .65, '#5fd0c9'); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) gBox([X + a * .2, y, Z + b * .2], [.04 + Math.abs(a) * .03, 0, 0], [0, 0, .04 + Math.abs(b) * .03], .5, '#c9d2da'); }
      else { GLB.x = X; GLB.y = Z; GLB.base = y; glCylAt(0, 0, .08, 1, 46, '#f4f4f2', '#f4f4f2', 10); gCone(0, 0, .08, 47, 9, '#ff8a3d', 10); GLB.x = GLB.y = GLB.base = 0; } }
    for (const d of DYN.drops) { const g = gGround(d.x, d.y), f = Math.min(1, d.t / 4), y = g + 24 * (1 - f) * (1 - f * .3); // a supply pod under its parachute
      gBox([d.x, y, d.y], [.09, 0, 0], [0, 0, .09], .14, '#e5874f'); gBox([d.x, y + .1, d.y], [.092, 0, 0], [0, 0, .092], .04, '#f4f4f2');
      if (d.t < 4) { const top = y + .75, C = gcol('#ffffff'), R = .42; GLB.ctr = [d.x, top - 1, d.y]; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, b = (k + 1) / 8 * TAU, P = (an, rr, hh) => [d.x + Math.cos(an) * rr, top + hh, d.y + Math.sin(an) * rr]; gtri(P(0, 0, .14), P(a, R, -.08), P(b, R, -.08), k % 2 ? C : gcol('#e5874f')); gBeam(P(a, R, -.08), [d.x, y + .14, d.y], .003, '#f4f4f2'); } } }
    if (DYN.intro && DYN.intro.p) { const p = DYN.intro.p, f = [.85, -.45, .3], n = Math.hypot(...f), F = V3s(f, 1 / n), Rr = V3s(V3x(F, [0, 1, 0]), 1 / Math.hypot(...V3x(F, [0, 1, 0]))), U = V3x(Rr, F);
      glOBox(p, V3s(F, .28), V3s(Rr, .14), V3s(U, .14), '#f2f3f6'); glOBox(V3a(p, V3s(F, -.05)), V3s(F, .05), V3s(Rr, .145), V3s(U, .145), '#e5874f'); glOBox(V3a(p, V3s(F, .2)), V3s(F, .05), V3s(Rr, .09), V3s(U, .09), '#7fcde6', 2); }
    if (night < .6) for (const b of DYN.birds) { const h = Math.atan2(b.vy, b.vx), f = [Math.cos(h), 0, Math.sin(h)], s = [-f[2], 0, f[0]], C = gcol('#3e3e4c'); // a flock in a V; they roost at night
      for (let k = 0; k < b.n; k++) { const r = Math.floor((k + 1) / 2), sd = k % 2 ? 1 : -1, c = [b.x - f[0] * r * .35 + s[0] * r * .25 * sd, b.h + Math.sin(t * 2 + k) * .05, b.y - f[2] * r * .35 + s[2] * r * .25 * sd], fl = Math.sin(t * 10 + k * 1.3) * .07;
        GLB.ctr = [c[0], c[1] - 1, c[2]]; for (const g of [1, -1]) gtri([c[0] + f[0] * .03, c[1], c[2] + f[2] * .03], [c[0] - f[0] * .03, c[1], c[2] - f[2] * .03], [c[0] + s[0] * .1 * g - f[0] * .02, c[1] + fl, c[2] + s[2] * .1 * g - f[2] * .02], C); } }
    for (const g of DYN.giants) glGiant(g, t);
    for (const fl of DYN.flyers) glFlyer(fl, t, lit);
    const mv = hasTech('hover') ? 'hover' : hasTech('motor') ? 'truck' : null; let cn = 0; // settlers moving to a new town: on foot with packs, later a convoy of lorries, then hover pods
    for (const cv of DYN.caravans) { const p = caravanPos(cv); if (!p) continue; const h = glHeading(cv, p[4], p[5]), y = p[2] * ZS;
      if (mv) { if (cn++ % 3 === 0) glTrader({ kind: mv, col: cv.col, r: 'goods', s: cv.s }, p[0], p[1], y, h, lit); continue; }
      cv.kid = false; cv.skin = cv.skin || SKIN[(cv.off * 997 | 0) % SKIN.length]; glPerson(cv, p[0], p[1], y, h, true, false); const f = [Math.cos(h), 0, Math.sin(h)]; glOBox([p[0] - f[0] * .04, y + .19, p[1] - f[2] * .04], V3(f, .022), [-f[2] * .03, 0, f[0] * .03], [0, .04, 0], '#8a6446'); }
    for (const o of DYN.traders) { const p = pathPos(o, .12, true, true); if (!p) continue; glTrader(o, p[0], p[1], p[2] * ZS, glHeading(o, p[4], p[5]), lit); }
    if (DYN.drone && S.T[1]) { const T = S.T[1], a = DYN.t * .25, X = T.x + Math.cos(a) * 1.6, Z = T.y + Math.sin(a) * 1.6, y = gGround(T.x, T.y) + .75 + Math.sin(DYN.t * 2) * .08; // the helper drone from the pod
      glOBox([X, y, Z], [.05, 0, 0], [0, 0, .03], [0, .012, 0], '#e8eaef'); for (const [a2, b2] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) glOBox([X + a2 * .06, y + .015, Z + b2 * .04], [.022, 0, 0], [0, 0, .022], [0, .002, 0], '#9aa1ad');
      if ((DYN.t * 2) % 1 < .5) glOBox([X, y - .015, Z], [.008, 0, 0], [0, 0, .008], [0, .006, 0], '#e5874f', 2); }
  } finally { [GLB.x, GLB.y, GLB.base] = sv; }
}
function glGiant(g, t) { // a Longstrider: a pale body high up on four long legs, a long neck, ambling across the valley
  const X = g.fx, Z = g.fy, y0 = gGround(X, Z), h = Math.atan2(g.dy, g.dx), f = [Math.cos(h), 0, Math.sin(h)], s = [-f[2], 0, f[0]], B = [X, y0 + 3.6 + Math.sin(t * 1.4) * .05, Z];
  for (const [df, ds, ph] of [[.3, .25, 0], [.3, -.25, Math.PI], [-.3, .25, Math.PI], [-.3, -.25, 0]]) { const sw = Math.sin(t * 1.4 + ph) * .35, top = [B[0] + f[0] * df * .5 + s[0] * ds * .5, B[1], B[2] + f[2] * df * .5 + s[2] * ds * .5], foot = [B[0] + f[0] * (df + sw) + s[0] * ds * 1.6, y0, B[2] + f[2] * (df + sw) + s[2] * ds * 1.6], knee = [(top[0] + foot[0]) / 2 + s[0] * ds * .5, B[1] * .55 + y0 * .45 + .4, (top[2] + foot[2]) / 2 + s[2] * ds * .5];
    gBeam(top, knee, .028, '#c9b8d8'); gBeam(knee, foot, .022, '#c9b8d8'); }
  GLB.x = 0; GLB.y = 0; GLB.base = 0; glBlob(B[0], B[2], .5, B[1] / ZS, .5, '#d8c9e6', 0);
  const n0 = [B[0] + f[0] * .4, B[1] + .1, B[2] + f[2] * .4], hd = [B[0] + f[0] * (.85 + Math.sin(t * .7) * .05), B[1] + 1.3, B[2] + f[2] * (.85 + Math.sin(t * .7) * .05)];
  gBeam(n0, hd, .07, '#d8c9e6'); glOBox(V3a(hd, V3s(f, .06)), V3s(f, .13), V3s(s, .07), [0, .06, 0], '#d8c9e6'); glOBox(V3a(hd, V3a(V3s(f, .15), [0, .03, 0])), [.01, 0, 0], [0, 0, .01], [0, .01, 0], '#3a3340');
}
function glFlyer(o, t, lit) { // what crosses the sky now and then
  const h = Math.atan2(o.vy, o.vx), f = [Math.cos(h), 0, Math.sin(h)], s = [-f[2], 0, f[0]], X = o.x, Z = o.y, y = o.h + (o.kind === 'balloon' ? Math.sin(t * .6) * .15 : 0), P = (a, b, c) => [X + f[0] * a + s[0] * b, y + c, Z + f[2] * a + s[2] * b];
  if (o.kind === 'balloon') { GLB.x = GLB.y = GLB.base = 0; glBlob(X, Z, .55, (y + .55) / ZS, 1.15, o.col, 0); glOBox(P(0, 0, -.25), [.08, 0, 0], [0, 0, .08], [0, .06, 0], '#8a6446'); for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) gBeam(P(a * .07, b * .07, -.2), P(a * .3, b * .3, .25), .004, '#6b5040'); }
  else if (o.kind === 'airship') { glOBox(P(0, 0, 0), V3(f, 1.1), V3(s, .32), [0, .3, 0], '#e9dcc4'); glOBox(P(.05, 0, .2), V3(f, .95), V3(s, .26), [0, .12, 0], '#f7efe0'); glOBox(P(.1, 0, -.42), V3(f, .25), V3(s, .08), [0, .07, 0], '#8a6d57'); for (const sg of [1, -1]) glOBox(P(-1.05, sg * .25, 0), V3(f, .15), V3(s, .12), [0, .01, 0], '#d98c3f'); glOBox(P(-1.05, 0, .25), V3(f, .15), V3(s, .01), [0, .14, 0], '#d98c3f'); }
  else if (o.kind === 'plane') { glOBox(P(0, 0, 0), V3(f, .55), V3(s, .07), [0, .07, 0], '#f7f7f5'); glOBox(P(.05, 0, 0), V3(f, .12), V3(s, .6), [0, .015, 0], '#f7f7f5'); glOBox(P(-.5, 0, .12), V3(f, .07), V3(s, .01), [0, .1, 0], '#e05b52'); glOBox(P(-.5, 0, .05), V3(f, .06), V3(s, .2), [0, .01, 0], '#f7f7f5'); }
  else if (o.kind === 'drones') for (let k = 0; k < 5; k++) { const c = P(-k * .35, (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .2, Math.sin(t * 3 + k) * .08); glOBox(c, [.05, 0, 0], [0, 0, .05], [0, .01, 0], '#e8eaef'); if ((t * 3 + k) % 1 < .4) glOBox([c[0], c[1] - .02, c[2]], [.01, 0, 0], [0, 0, .01], [0, .006, 0], '#7fe8e0', 2); }
  else { glOBox(P(0, 0, 0), V3(f, .6), V3(s, .16), [0, .08, 0], '#f4f6f8'); glOBox(P(.3, 0, .06), V3(f, .2), V3(s, .08), [0, .05, 0], '#9fd6e8'); glOBox(P(-.62, 0, 0), V3(f, .04), V3(s, .1), [0, .05, 0], '#7fe8e0', 2); }
  if (lit && (t * 1.3) % 1 < .35) for (const [sg, c] of [[1, '#ff4d4d'], [-1, '#7dff9a']]) glOBox(P(0, sg * (o.kind === 'plane' ? .6 : .3), 0), [.015, 0, 0], [0, 0, .015], [0, .015, 0], c, 2); // navigation lights
}
function glTrader(o, X, Z, y, h, lit) { // a trade wagon (a cart and horse, a lorry, a hover pod) with its load
  const f = [Math.cos(h), 0, Math.sin(h)], s = [-f[2], 0, f[0]], P = (a, b, c) => [X + f[0] * a + s[0] * b, y + c, Z + f[2] * a + s[2] * b], lc = RES_COL[o.r] || '#a57c55';
  if (o.kind === 'wagon') { glVehicle({ kind: 'cart', s: o.s }, X, Z, y, h, true); glOBox(P(-.03, 0, .105), V3(f, .05), V3(s, .033), [0, .015, 0], o.r === 'wood' ? '#8f6440' : lc); return; }
  if (o.kind === 'truck') { for (const [a, b] of [[.07, .045], [.07, -.045], [-.08, .045], [-.08, -.045]]) glOBox(P(a, b, .025), V3(f, .025), V3(s, .01), [0, .025, 0], '#2a2c30');
    glOBox(P(.09, 0, .07), V3(f, .04), V3(s, .045), [0, .04, 0], o.col); glOBox(P(.12, 0, .09), V3(f, .006), V3(s, .038), [0, .018, 0], '#bcd3e0');
    glOBox(P(-.05, 0, .055), V3(f, .1), V3(s, .05), [0, .012, 0], '#6f7680'); glOBox(P(-.05, 0, .09), V3(f, .09), V3(s, .045), [0, .025, 0], lc);
    if (lit) for (const sg of [1, -1]) glOBox(P(.132, sg * .03, .07), [.005, 0, 0], [0, 0, .005], [0, .005, 0], '#fff4d6', 2); return; }
  glVehicle({ kind: 'hover', s: o.s }, X, Z, y, h, true); glOBox(P(0, 0, .14), V3(f, .05), V3(s, .028), [0, .015, 0], lc);
}
// the people you know carry a diamond over their heads (the founder orange, a leader gold, the newly famous green); a candle when they pray
function glMark(w, X, Z, y0) {
  const p = S.P[w.pid]; if (!p) return; const T = S.T[p.sid], top = y0 + (w.kid ? .17 : .22) + Math.sin(GL3.t * 2 + w.pid) * .01;
  const col = w.pid === S.founder ? '#e5874f' : T && T.leader === p.id ? '#f2b84b' : p.fl != null && p.fl <= 3 ? '#7fd08a' : '#5fd0c9', a = .035, C = gcol(col), sv = GLB.mat; GLB.mat = 0; GLB.ctr = [X, top, Z];
  for (const [u, v] of [[a, 0], [0, a], [-a, 0], [0, -a]].map((q, k, A) => [q, A[(k + 1) % 4]])) for (const yy of [top + a * 1.4, top - a * 1.4]) gtri([X + u[0], top, Z + u[1]], [X + v[0], top, Z + v[1]], [X, yy, Z], C, 2);
  GLB.mat = sv;
  if ((S.prayers || []).some(q => q.st === 'open' && q.pid === w.pid)) FXA.glow.push(X, top + .09, Z, .12, 1, .82, .48, .55 + .2 * Math.sin(GL3.t * 7 + w.pid), 0, 0, 0, 0, 0); // a candle over them
}
function glPrayerCandles() { // someone praying at home: a candle burns over the house
  for (const q of S.prayers || []) { if (q.st !== 'open') continue; const w = DYN.walkers.find(w => w.pid === q.pid); if (!w || w.st !== 'in') continue; const B = S.B[w.at]; if (!B) continue;
    FXA.glow.push(B.x, gGround(B.x, B.y) + objH(idx(B.x, B.y)) * ZS * .9 + .2, B.y, .18, 1, .82, .48, .6 + .2 * Math.sin(GL3.t * 7 + q.pid), 0, 0, 0, 0, 0); }
}

/* ---------- words over the view: floating captions and the names of places ---------- */
function glOverlay(VP, cw, ch) {
  let box = $('ovl'); if (!box) { box = document.createElement('div'); box.id = 'ovl'; box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;overflow:hidden'; document.body.appendChild(box); }
  const proj = (x, y, z) => { const c = [VP[0] * x + VP[4] * y + VP[8] * z + VP[12], VP[1] * x + VP[5] * y + VP[9] * z + VP[13], VP[3] * x + VP[7] * y + VP[11] * z + VP[15]]; if (c[2] <= .05) return null; return [(c[0] / c[2] * .5 + .5) * innerWidth, (1 - (c[1] / c[2] * .5 + .5)) * innerHeight]; };
  const keep = new Set(), el = (key, cls, html) => { keep.add(key); let e = box.querySelector(`[data-k="${key}"]`); if (!e) { e = document.createElement('div'); e.dataset.k = key; e.className = cls; e.innerHTML = html; box.appendChild(e); } return e; };
  // the names of places, clearer as you pull back
  if (S.names && S.names.length) { const za = sstep(2.5, 8, GL3.cam.zoom) * .85 + .15, night = (LIGHT.nightK || 0) > .5;
    for (const f of S.names) { const x = f.i % W, y = (f.i / W) | 0, q = proj(x, (M.water[f.i] ? SEAZ : surfZ(f.i)) * ZS + (f.k === 'peak' ? .9 : .3), y); if (!q || q[0] < -100 || q[1] < -40 || q[0] > innerWidth + 100 || q[1] > innerHeight + 40) continue;
      const e = el('n' + f.i, 'plabel' + (night ? ' night' : '') + (f.k === 'river' || f.k === 'sea' ? ' water' : ''), esc(f.k === 'peak' ? '▲ ' + f.n : f.n)); e.style.transform = `translate(${q[0] | 0}px,${q[1] | 0}px) translate(-50%,-50%)`; e.style.opacity = za; } }
  // captions over what just happened (chronicle news with a place), rising gently and fading
  const placed = [];
  for (const c of DYN.caps) { const q = proj(c.x, gGround(c.x, c.y) + 1.4 + Math.min(c.age, 4) * .06, c.y); if (!q) continue; const a = Math.min(1, c.age / .6, (c.life - c.age) / 1.5); if (a <= 0) continue;
    const e = el('c' + c.id, 'fcap' + (c.major ? ' major' : ''), `<i>${esc(c.ic)}</i>${esc(c.t)}`); let yy = q[1];
    for (const p of placed) if (Math.abs(p[0] - q[0]) < 220 && Math.abs(p[1] - yy) < 30) yy = p[1] - 32; placed.push([q[0], yy]);
    e.style.transform = `translate(${clamp(q[0], 120, innerWidth - 120) | 0}px,${clamp(yy, 40, innerHeight - 20) | 0}px) translate(-50%,-100%)`; e.style.opacity = a; }
  for (const e of [...box.children]) if (!keep.has(e.dataset.k)) e.remove();
}
