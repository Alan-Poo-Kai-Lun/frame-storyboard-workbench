/* One canvas, one loop, seven motion models. Soft particles are drawn from a
   pre-rendered sprite; never create gradients or shadows per frame. */
(function () {
  const STYLES = {
    stardust: { color: 'rgba(205,240,255,1)', size: [1.2, 2.6], blend: 'lighter' },
    motes: { color: 'rgba(200,215,230,1)', size: [4, 9], blend: 'source-over' },
    rain: { color: 'rgba(120,240,220,1)', size: [1, 1], blend: 'lighter' },
    snow: { color: 'rgba(235,245,255,1)', size: [2.4, 4.6], blend: 'lighter' },
    fireflies: { color: 'rgba(255,225,140,1)', size: [7, 14], blend: 'lighter' },
    sparks: { color: 'rgba(255,170,90,1)', size: [2, 4.2], blend: 'lighter' },
    ink: { color: 'rgba(170,190,205,1)', size: [20, 40], blend: 'source-over' }
  };

  let canvas = null, ctx = null, theme = null, parts = [], raf = 0, phase = 0, last = 0, width = 0, height = 0;
  let paused = false, interacting = false, ratio = 1, slowFrames = 0, budget = 1, signature = '';
  const sprites = {};
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  function sprite(color) {
    if (sprites[color]) return sprites[color];
    const tile = document.createElement('canvas');
    tile.width = tile.height = 64;
    const paint = tile.getContext('2d');
    const gradient = paint.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.35, color.replace('1)', '.42)'));
    gradient.addColorStop(1, color.replace('1)', '0)'));
    paint.fillStyle = gradient;
    paint.fillRect(0, 0, 64, 64);
    sprites[color] = tile;
    return tile;
  }

  const random = (min, max) => min + Math.random() * (max - min);

  function measure() {
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    width = Math.max(0, box.width);
    height = Math.max(0, box.height);
    ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function seed() {
    parts = [];
    if (!theme || theme.particles.style === 'none' || !width || !height) return;
    const style = STYLES[theme.particles.style];
    if (!style) return;
    const count = Math.round(theme.particles.count * budget);
    for (let index = 0; index < count; index += 1) {
      parts.push({
        x: random(0, width), y: random(0, height),
        r: random(style.size[0], style.size[1]) * theme.particles.size,
        vx: random(-0.2, 0.2), vy: random(-0.2, 0.2),
        phase: random(0, Math.PI * 2), alpha: random(0.35, 1), tail: random(10, 26)
      });
    }
  }

  function frame(now) {
    raf = 0;
    if (!canvas || !ctx || !theme) return;
    const motion = theme.particles.style !== 'none' && !paused && !reduce?.matches;
    if (!motion) { ctx.clearRect(0, 0, width, height); return; }
    raf = requestAnimationFrame(frame);
    const wait = interacting ? 100 : 1000 / 30;
    if (now - last < wait) return;
    const delta = last ? Math.min(120, now - last) / 1000 : 0;
    last = now;
    phase += delta * theme.particles.speed;

    ctx.clearRect(0, 0, width, height);
    const style = STYLES[theme.particles.style];
    const img = sprite(style.color);
    ctx.globalCompositeOperation = style.blend;

    for (const p of parts) {
      switch (theme.particles.style) {
        case 'stardust': p.x += Math.sin(phase * 0.4 + p.phase) * 0.18; p.y -= 0.16; p.alpha = 0.5 + Math.sin(phase + p.phase) * 0.35; break;
        case 'motes': p.x += Math.sin(phase * 0.2 + p.phase) * 0.12; p.y += Math.cos(phase * 0.17 + p.phase) * 0.1; p.alpha = 0.55; break;
        case 'rain': p.y += 2.6; p.x += 0.35; break;
        case 'snow': p.y += 0.42; p.x += Math.sin(phase * 0.6 + p.phase) * 0.5; break;
        case 'fireflies': p.vx += Math.sin(phase * 0.5 + p.phase) * 0.006; p.vy += Math.cos(phase * 0.7 + p.phase) * 0.006; p.vx *= 0.98; p.vy *= 0.98; p.x += p.vx; p.y += p.vy; p.alpha = 0.35 + Math.abs(Math.sin(phase * 0.9 + p.phase)) * 0.6; break;
        case 'sparks': p.y -= 1.1; p.x += Math.sin(phase + p.phase) * 0.35; p.alpha = 0.3 + Math.abs(Math.sin(phase * 3 + p.phase)) * 0.6; break;
        case 'ink': p.x += Math.sin(phase * 0.12 + p.phase) * 0.08; p.y += Math.cos(phase * 0.1 + p.phase) * 0.07; p.alpha = 0.5; break;
        default: break;
      }
      if (p.y < -40) { p.y = height + 20; p.x = random(0, width); }
      if (p.y > height + 40) { p.y = -20; p.x = random(0, width); }
      if (p.x < -50) p.x = width + 30;
      if (p.x > width + 50) p.x = -30;

      const gain = theme.particles.style === 'rain' ? 0.8 : (theme.particles.style === 'motes' || theme.particles.style === 'ink' ? 0.7 : 1.4);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * theme.particles.opacity * gain));
      if (theme.particles.style === 'rain') {
        ctx.strokeStyle = style.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 0.12 * p.tail, p.y - p.tail);
        ctx.stroke();
      } else {
        const size = p.r * 2;
        ctx.drawImage(img, p.x - p.r, p.y - p.r, size, size);
      }
    }
    ctx.globalAlpha = 1;

    // If the machine cannot keep up, halve the budget once and keep going.
    if (now - last > 40 && !interacting) {
      slowFrames += 1;
      if (slowFrames > 30 && budget > 0.25) { budget = budget / 2; slowFrames = 0; seed(); }
    } else slowFrames = 0;
  }

  function sync(next) {
    if (next) theme = next;
    if (!canvas || !ctx) return;
    const active = theme && theme.particles.style !== 'none' && theme.particles.count > 0;
    canvas.hidden = !active;
    if (!active) { cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, width, height); return; }
    const next_signature = theme.particles.style + '|' + theme.particles.count + '|' + theme.particles.size;
    if (!parts.length || next_signature !== signature) { signature = next_signature; seed(); }
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  }

  function attach(element) {
    canvas = element;
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    measure();
    seed();
    sync();
  }

  window.frameParticles = {
    attach,
    sync,
    measure: () => { measure(); seed(); },
    setInteracting(value) { interacting = !!value; if (value) { last = 0; } },
    setPaused(value) { paused = !!value; if (!paused) { last = 0; if (!raf) raf = requestAnimationFrame(frame); } },
    get style() { return theme?.particles.style || 'none'; },
    get count() { return parts.length; }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (theme && theme.particles.style !== 'none') { last = 0; raf = requestAnimationFrame(frame); }
  });
  window.addEventListener('resize', () => { measure(); seed(); });
  reduce?.addEventListener?.('change', () => sync());
})();
