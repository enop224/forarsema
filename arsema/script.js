(function () {
  var cv = document.getElementById('c');
  var ctx = cv.getContext('2d');
  var hint = document.getElementById('hint');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, DPR = 1, F = 600, CX = 0, CY = 0;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    F = Math.min(W * 1.0, H * 0.75);
    CX = W / 2; CY = H * 0.54;
  }
  resize();
  window.addEventListener('resize', resize);

  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeIO(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ---------- words ---------- */
  var N = 660, HS = 0.55, HZ = 1.3, RNG = 3.18, hk = 0;
  var words = [];
  function pickText() {
    var r = Math.random();
    return r < 0.45 ? 'I love you' : r < 0.9 ? 'Te amo' : r < 0.96 ? 'Arsema' : '♥';
  }
  for (var i = 0; i < N; i++) {
    var extra = (i % 3 !== 0);
    var u = extra ? Math.random() : (i / 3) / (N / 3), t = pickText();
    var special = (t === 'Arsema' || t === '♥');
    var tt = Math.random() * TAU;
    var hx = 16 * Math.pow(Math.sin(tt), 3);
    var hy = 13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt);
    var s = Math.random() < 0.5 ? 0.88 + Math.random() * 0.12 : Math.sqrt(Math.random()) * 0.88;
    var depth = (Math.random() - 0.5) * 2 * 0.45 * HS * (1 - 0.8 * s * s);
    words.push({
      t: t,
      size: (0.03 + 0.022 * u) * (special ? 1.3 : 1),
      hue: special ? 328 : 318 + Math.random() * 24,
      lift: special ? 14 : 0,
      extra: extra, vis: extra ? 0 : 1,
      ang: u * TAU * 8, r: 0.1 + 0.62 * Math.pow(u, 1.1), bz: 3.2 - 2.3 * u,
      hx: (hx * s) / 17 * HS, hy: -((hy * s) + 2.5) / 17 * HS, hz: depth,
      delay: Math.random(), arc: (Math.random() - 0.5) * 0.4, ph: Math.random() * TAU,
      x: 0, y: 0, z: 1, fx: 0, fy: 0, fz: 1, tx: 0, ty: 0, tz: 1
    });
  }

  var stars = [];
  for (var k = 0; k < 90; k++) stars.push({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.1, ph: Math.random() * TAU });

  /* ---------- state ---------- */
  var mode = 'idle'; // idle | journey | morph | heart
  var time = 0, t0 = 0, spin = 0, dz = 0;
  var JD = reduce ? 0.01 : 3.2, MD = reduce ? 0.6 : 2.8;
  var rotY = 0, rotX = 0, velY = 0;
  var dragging = false, lastX = 0, lastY = 0, lastT = 0;

  function start() {
    if (mode !== 'idle') return;
    mode = 'journey'; t0 = time;
    document.body.classList.add('running');
  }
  function reset() {
    mode = 'idle'; dz = 0; spin = 0; velY = 0; rotX = 0;
    document.body.classList.remove('running', 'revealed');
    hint.textContent = 'Tap the screen to start the journey';
  }

  cv.addEventListener('pointerdown', function (e) {
    if (mode === 'idle') { start(); return; }
    if (mode === 'heart' || mode === 'morph') {
      dragging = true; lastX = e.clientX; lastY = e.clientY; lastT = e.timeStamp || performance.now();
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });
  cv.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var now = e.timeStamp || performance.now();
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    var dts = Math.max(0.008, (now - lastT) / 1000);
    rotY += dx * 0.009;
    velY = clamp((dx * 0.009) / dts, -9, 9);
    rotX = clamp(rotX + dy * 0.006, -0.7, 0.7);
    lastX = e.clientX; lastY = e.clientY; lastT = now;
  });
  function endDrag() { dragging = false; }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); }
    if (mode === 'heart') {
      if (e.key === 'ArrowLeft') velY = -3;
      if (e.key === 'ArrowRight') velY = 3;
    }
  });
  document.getElementById('replay').addEventListener('click', reset);

  /* ---------- update ---------- */
  function tunnelPos(w) {
    var z = 0.12 + ((((w.bz - 0.12 - dz) % RNG) + RNG) % RNG);
    var a = w.ang + spin;
    w.x = w.r * Math.cos(a); w.y = w.r * Math.sin(a); w.z = z;
  }
  function heartPos(w, pulse) {
    var cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    var jx = Math.sin(time * 1.3 + w.ph) * 0.004, jy = Math.cos(time * 1.1 + w.ph) * 0.004;
    var x0 = (w.hx + jx) * pulse, y0 = (w.hy + jy) * pulse, z0 = w.hz * pulse;
    var x1 = x0 * cy + z0 * sy;
    var z1 = -x0 * sy + z0 * cy;
    var y2 = y0 * cx - z1 * sx;
    var z2 = y0 * sx + z1 * cx;
    w.tx = x1; w.ty = y2; w.tz = z2 + HZ;
  }

  function update(dt) {
    var i, w;
    if (mode === 'idle') {
      spin += 0.14 * dt;
      for (i = 0; i < N; i++) { tunnelPos(words[i]); words[i].vis = words[i].extra ? 0 : 1; }
    } else if (mode === 'journey') {
      var k = (time - t0) / JD;
      var ramp = smooth(k / 0.35);
      dz += ramp * 3.4 * dt;
      spin += (0.14 + 2.2 * ramp) * dt;
      for (i = 0; i < N; i++) { tunnelPos(words[i]); words[i].vis = words[i].extra ? 0 : 1; }
      if (k >= 1) {
        for (i = 0; i < N; i++) { w = words[i]; w.fx = w.x; w.fy = w.y; w.fz = w.z; }
        mode = 'morph'; t0 = time;
      }
    }
    if (mode === 'morph' || mode === 'heart') {
      if (!dragging) {
        velY *= Math.exp(-2.2 * dt);
        rotY += ((reduce ? 0 : 0.35) + velY) * dt;
        rotX *= Math.exp(-1.2 * dt);
      }
      var beat = reduce ? 0 : Math.pow(Math.max(0, Math.sin(time * 3.4)), 8);
      var pulse = 1 + 0.045 * beat;
      var te = mode === 'morph' ? (time - t0) / MD : 1;
      hk = smooth(te);
      for (i = 0; i < N; i++) {
        w = words[i];
        heartPos(w, pulse);
        if (mode === 'morph') {
          var e = easeIO((te - w.delay * 0.4) / 0.6);
          w.x = w.fx + (w.tx - w.fx) * e;
          w.y = w.fy + (w.ty - w.fy) * e + Math.sin(e * Math.PI) * w.arc;
          w.z = w.fz + (w.tz - w.fz) * e;
          w.vis = w.extra ? e : 1;
        } else { w.x = w.tx; w.y = w.ty; w.z = w.tz; w.vis = 1; }
      }
      if (mode === 'morph' && te > 0.55 && !document.body.classList.contains('revealed')) {
        document.body.classList.add('revealed');
        hint.textContent = 'Drag the screen to rotate the heart';
      }
      if (mode === 'morph' && te >= 1) mode = 'heart';
    }
  }

  /* ---------- draw ---------- */
  function draw() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#07040c';
    ctx.fillRect(0, 0, W, H);

    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      var a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(time * 1.2 + st.ph));
      ctx.fillStyle = 'rgba(255,225,242,' + a.toFixed(2) + ')';
      ctx.fillRect(st.x * W, st.y * H, st.r, st.r);
    }

    var glow = mode === 'heart' ? 1 : mode === 'morph' ? smooth((time - t0) / MD) : 0.15;
    var g = ctx.createRadialGradient(CX, CY, 0, CX, CY, F * 0.62);
    g.addColorStop(0, 'rgba(255,45,149,' + (0.3 * glow).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,45,149,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < N; i++) {
      var w = words[i], z = w.z;
      if (z < 0.1) continue;
      var sx = CX + (w.x / z) * F, sy = CY + (w.y / z) * F;
      var px = Math.round(Math.min(110, w.size * (1 - 0.4 * hk) * F / z));
      if (px < 3) continue;
      if (sx < -220 || sx > W + 220 || sy < -120 || sy > H + 120) continue;
      var alpha = Math.min(1, (z - 0.12) / 0.3) * 0.88 * (1 - 0.42 * hk) * w.vis;
      if (alpha <= 0.02) continue;
      var lum = 50 + 30 * clamp((2.4 - z) / 1.6, 0, 1) + w.lift - 12 * hk;
      ctx.font = '700 ' + px + 'px Manrope, system-ui, sans-serif';
      ctx.fillStyle = 'hsla(' + w.hue.toFixed(0) + ',100%,' + lum.toFixed(0) + '%,' + alpha.toFixed(2) + ')';
      ctx.fillText(w.t, sx, sy);
    }
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now; time += dt;
    update(dt); if (mode === 'idle' || mode === 'journey') hk = 0; draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();