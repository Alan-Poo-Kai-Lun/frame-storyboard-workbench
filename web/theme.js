/* Dynamic themes: backdrop + atmosphere + material + transition.
   Colours stay in the existing appearance object; a preset is only a bundle of the rest. */
(function () {
  const DEFAULTS = {
    preset: 'aurora',
    backdrop: { type: 'gradient', css: '', url: '', dim: 0.35, vignette: 0.35, blur: 0 },
    particles: { style: 'stardust', count: 140, speed: 1, size: 1, opacity: 0.55 },
    transition: { kind: 'crossfade', duration: 750 }
  };

  const GRADIENT = {
    cyber: 'radial-gradient(70% 80% at 28% 26%,#0d3b46 0%,transparent 64%),radial-gradient(60% 70% at 78% 74%,#3a1140 0%,transparent 62%),linear-gradient(160deg,#05080d,#0a1620 58%,#071018)',
    aurora: 'radial-gradient(60% 70% at 26% 34%,#123f4a 0%,transparent 66%),radial-gradient(60% 70% at 70% 68%,#2b1e4a 0%,transparent 64%),linear-gradient(165deg,#070b12,#0b1220 58%,#080c14)',
    film: 'radial-gradient(55% 65% at 30% 40%,#2a1d12 0%,transparent 64%),radial-gradient(60% 70% at 74% 66%,#241608 0%,transparent 62%),linear-gradient(150deg,#0b0906,#14100a 60%,#0a0805)',
    rain: 'radial-gradient(65% 75% at 32% 30%,#0b2230 0%,transparent 62%),radial-gradient(55% 65% at 74% 70%,#1a1030 0%,transparent 60%),linear-gradient(160deg,#05080e,#0a121c 58%,#060b12)',
    snow: 'radial-gradient(70% 80% at 30% 28%,#12222b 0%,transparent 66%),linear-gradient(165deg,#080d12,#0d1720 60%,#070c11)',
    forest: 'radial-gradient(65% 75% at 30% 34%,#0e2a1f 0%,transparent 64%),linear-gradient(160deg,#050b08,#0a1712 60%,#060d09)',
    forge: 'radial-gradient(60% 70% at 32% 40%,#3a1608 0%,transparent 64%),radial-gradient(55% 65% at 72% 68%,#2a0c08 0%,transparent 62%),linear-gradient(160deg,#0c0604,#170b06 58%,#0a0504)',
    ink: 'radial-gradient(70% 80% at 34% 30%,#1a1a18 0%,transparent 66%),linear-gradient(160deg,#0a0a09,#131312 60%,#080807)',
    matrix: 'radial-gradient(60% 70% at 50% 40%,#07130d 0%,transparent 70%),linear-gradient(160deg,#030705,#061009 60%,#020604)',
    quiet: 'linear-gradient(160deg,#0b0d10,#101318 60%,#0a0c0f)'
  };

  const PRESETS = [
    { id: 'cyber', name: '赛博底片', hint: '数据雨 + 扫描线', backdrop: { dim: 0.5, vignette: 0.4 }, particles: { style: 'rain', count: 130, speed: 1, size: 1, opacity: 0.5 } },
    { id: 'aurora', name: '极光深空', hint: '星尘缓浮', backdrop: { dim: 0.4, vignette: 0.35 }, particles: { style: 'stardust', count: 140, speed: 0.8, size: 1, opacity: 0.6 } },
    { id: 'film', name: '暗房胶片', hint: '浮尘', backdrop: { dim: 0.3, vignette: 0.45 }, particles: { style: 'motes', count: 30, speed: 0.6, size: 0.7, opacity: 0.25 } },
    { id: 'rain', name: '雨夜霓虹', hint: '细雨', backdrop: { dim: 0.5, vignette: 0.4 }, particles: { style: 'rain', count: 90, speed: 0.7, size: 1, opacity: 0.42 } },
    { id: 'snow', name: '雪原清晨', hint: '落雪', backdrop: { dim: 0.35, vignette: 0.3 }, particles: { style: 'snow', count: 110, speed: 0.7, size: 1.2, opacity: 0.55 } },
    { id: 'forest', name: '萤火密林', hint: '萤火', backdrop: { dim: 0.42, vignette: 0.42 }, particles: { style: 'fireflies', count: 44, speed: 0.8, size: 1, opacity: 0.55 } },
    { id: 'forge', name: '熔炉火星', hint: '火星', backdrop: { dim: 0.45, vignette: 0.42 }, particles: { style: 'sparks', count: 90, speed: 1.1, size: 1, opacity: 0.5 } },
    { id: 'ink', name: '水墨留白', hint: '墨点', backdrop: { dim: 0.25, vignette: 0.3 }, particles: { style: 'ink', count: 10, speed: 0.5, size: 0.5, opacity: 0.18 } },
    { id: 'matrix', name: '数据矩阵', hint: '网格 + 雨', backdrop: { dim: 0.55, vignette: 0.3 }, particles: { style: 'rain', count: 110, speed: 1.2, size: 0.8, opacity: 0.4 } },
    { id: 'quiet', name: '纯色静默', hint: '只有颜色', backdrop: { dim: 0.2, vignette: 0.2 }, particles: { style: 'none', count: 0, speed: 0, size: 0, opacity: 0 } }
  ];

  const PARTICLE_LABELS = [['none', '无'], ['stardust', '星尘'], ['motes', '浮尘'], ['rain', '数据雨'], ['snow', '雪'], ['fireflies', '萤火'], ['sparks', '火花'], ['ink', '墨点']];
  const MEDIA_EXT = /\.(mp4|webm|mov|mkv)$/i;

  function number(value, fallback, min, max) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
  }

  function preset(id) {
    const row = PRESETS.find(item => item.id === id) || PRESETS[1];
    return {
      preset: row.id,
      backdrop: { ...DEFAULTS.backdrop, ...row.backdrop, css: GRADIENT[row.id] || GRADIENT.aurora, url: '' },
      particles: { ...DEFAULTS.particles, ...row.particles },
      transition: { ...DEFAULTS.transition }
    };
  }

  function resolve(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const base = preset(source.preset || 'aurora');
    const backdrop = { ...base.backdrop, ...(source.backdrop || {}) };
    const particles = { ...base.particles, ...(source.particles || {}) };
    const transition = { ...base.transition, ...(source.transition || {}) };
    const url = backdrop.url || (typeof backdrop.path === 'string' && backdrop.path.startsWith('/') ? backdrop.path : '');
    return {
      preset: source.preset || base.preset,
      backdrop: {
        ...backdrop,
        url,
        type: url ? (MEDIA_EXT.test(url) ? 'video' : 'image') : 'gradient',
        dim: number(backdrop.dim, 0.35, 0, 0.85),
        vignette: number(backdrop.vignette, 0.35, 0, 0.85),
        blur: number(backdrop.blur, 0, 0, 24),
        css: backdrop.css || GRADIENT[source.preset] || GRADIENT.aurora
      },
      particles: {
        ...particles,
        count: Math.round(number(particles.count, 140, 0, 220)),
        speed: number(particles.speed, 1, 0.2, 3),
        size: number(particles.size, 1, 0.5, 2),
        opacity: number(particles.opacity, 0.55, 0, 0.7)
      },
      transition: { kind: transition.kind === 'none' ? 'none' : 'crossfade', duration: Math.round(number(transition.duration, 750, 200, 1400)) }
    };
  }

  function apply(dialog, raw) {
    if (!dialog) return null;
    const theme = resolve(raw);
    const root = dialog.style;
    dialog.dataset.themeCurrent = theme.preset;
    dialog.dataset.backdropType = theme.backdrop.type;
    root.setProperty('--rfa-backdrop-dim', String(theme.backdrop.dim));
    root.setProperty('--rfa-vignette', String(theme.backdrop.vignette));
    root.setProperty('--rfa-backdrop-blur', theme.backdrop.blur + 'px');
    root.setProperty('--rfa-transition', theme.transition.duration + 'ms');
    window.frameParticles?.sync(theme);
    return theme;
  }

  /* Backdrops live in the workbench-wide store so every project can reuse them. */
  let cache = null;
  // The workbench keeps its session token in a top-level `let`, not on window.
  function sessionToken() { try { return typeof token !== 'undefined' && typeof token === 'string' ? token : ''; } catch (error) { return ''; } }

  function backdrops(force) {
    if (cache && !force) return cache;
    return cache || [];
  }

  async function refreshBackdrops() {
    try {
      const response = await fetch('/api/theme-backdrops', { headers: { 'X-Workbench-Token': sessionToken() } });
      const data = await response.json();
      cache = data.items || [];
    } catch (error) {
      cache = cache || [];
    }
    return cache;
  }

  async function uploadBackdrop(file) {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const response = await fetch('/api/theme-backdrops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Workbench-Token': sessionToken() },
      body: JSON.stringify({ name: file.name, mime: file.type, data })
    });
    const result = await response.json();
    if (result.error) throw Error(result.error);
    await refreshBackdrops();
    return result;
  }

  window.frameTheme = { DEFAULTS, PRESETS, PARTICLE_LABELS, preset, resolve, apply, backdrops, refreshBackdrops, uploadBackdrop, MEDIA_EXT };
})();
