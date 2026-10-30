/* Floating free-text note: drag anywhere, type freely, autosaves into the project. */
(() => {
  const POS_KEY = 'frame.notes.pos';
  let panel = null;
  let drag = null;

  const lang = () => (window.frameI18n?.language?.() === 'en' ? 'en' : 'zh');
  const T = () => (lang() === 'en'
    ? { btn: 'Note', title: 'Note', close: 'Close', placeholder: 'Jot anything down — saved automatically…' }
    : { btn: '笔记', title: '笔记', close: '关闭', placeholder: '随手记点什么，自动保存…' });

  function notes() {
    if (typeof P === 'undefined' || !P) return null;
    if (!Array.isArray(P.notes)) P.notes = [];
    if (!P.notes.length) P.notes.push({ id: 'note-1', text: '' });
    return P.notes;
  }

  function ensureButton() {
    const nav = document.querySelector('.canvasQuickNav');
    if (!nav || nav.querySelector('[data-frame-notes]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.frameNotes = '';
    btn.textContent = T().btn;
    btn.title = T().title;
    btn.addEventListener('click', toggle);
    nav.append(btn);
  }

  function toggle() {
    if (panel) { close(); return; }
    open();
  }

  function open() {
    const list = notes();
    if (!list) return;
    const note = list[0];
    const copy = T();
    panel = document.createElement('div');
    panel.className = 'frameNotePanel';
    panel.innerHTML = '<header><span></span><button type="button" data-note-close aria-label=""></button></header>'
      + '<textarea data-note-body spellcheck="false"></textarea>';
    const head = panel.querySelector('header');
    head.querySelector('span').textContent = copy.title;
    const closeBtn = head.querySelector('[data-note-close]');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', copy.close);
    const body = panel.querySelector('[data-note-body]');
    body.id = 'frameNoteBody';
    body.dataset.mentionContext = 'project';
    body.placeholder = copy.placeholder;
    body.value = note.text || '';
    // Reuse the shared @-mention editor so notes can reference the same assets.
    if (typeof mentionFields !== 'undefined' && mentionFields && typeof mentionFields.add === 'function') mentionFields.add('frameNoteBody');
    body.addEventListener('input', () => {
      note.text = body.value;
      if (typeof changed === 'function') changed();
    });
    // A modal <dialog> lives in the browser top layer, so a body-level fixed
    // panel is painted underneath it no matter how high the z-index is.
    const host = document.getElementById('overviewDialog') || document.body;
    host.append(panel);
    // Must run after the panel is in the document: refreshMentionEditors only
    // walks textareas that document.querySelectorAll can actually see.
    if (typeof refreshMentionEditors === 'function') refreshMentionEditors();
    const pos = restorePos();
    panel.style.left = pos.x + 'px';
    panel.style.top = pos.y + 'px';
    panel.style.width = (note.w || 440) + 'px';
    panel.style.height = (note.h || 340) + 'px';
    head.addEventListener('pointerdown', startDrag);
    closeBtn.addEventListener('click', close);
    body.focus();
  }

  function startDrag(e) {
    if (e.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setDragging(e, true);
    document.addEventListener('pointermove', onDrag);
    document.addEventListener('pointerup', endDrag);
  }

  function setDragging(e, on) {
    panel.classList.toggle('dragging', on);
    try { panel.setPointerCapture(e.pointerId); } catch {}
  }

  function onDrag(e) {
    if (!drag || !panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const x = Math.max(8, Math.min(window.innerWidth - Math.min(w, 160), e.clientX - drag.dx));
    const y = Math.max(8, Math.min(window.innerHeight - 48, e.clientY - drag.dy));
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
  }

  function endDrag() {
    drag = null;
    if (panel) panel.classList.remove('dragging');
    document.removeEventListener('pointermove', onDrag);
    document.removeEventListener('pointerup', endDrag);
    persist();
  }

  function persist() {
    if (!panel) return;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({
        x: parseInt(panel.style.left, 10) || 0,
        y: parseInt(panel.style.top, 10) || 0
      }));
    } catch {}
    const list = notes();
    if (list && list[0]) {
      list[0].w = panel.offsetWidth;
      list[0].h = panel.offsetHeight;
      if(typeof changed==='function')changed();
    }
  }

  function restorePos() {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
    } catch {}
    return { x: Math.max(16, window.innerWidth - 480), y: 140 };
  }

  function close() {
    persist();
    if (panel) panel.remove();
    panel = null;
  }

  window.frameNotes = { toggle, open, close, get isOpen() { return !!panel; } };

  let timer = null;
  const watch = () => {
    ensureButton();
    clearTimeout(timer);
    timer = setTimeout(watch, 1500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
})();
