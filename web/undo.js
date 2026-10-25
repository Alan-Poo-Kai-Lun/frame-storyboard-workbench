/* One undo stack for the whole project.
   Projects are small now (media is a hash map), so a snapshot per operation is
   cheap and far less error-prone than a diff for every field type. */
(function () {
  const LIMIT = 30;
  const rows = [];
  const forward = [];
  const clone = value => structuredClone(value);
  const stamp = p => JSON.stringify([p.assets, p.segments, p.title, p.aspect, p.fps, p.dialogueLanguage,
    p.generation, p.intent, p.writingRuleIds, p.overviewLayout?.unifiedFlow?.notes || [], p.media]);

  // The workbench keeps its live project in a top-level `let P` (not window.P),
  // so read the global binding lazily and tolerate early calls.
  function project() { try { return typeof P !== 'undefined' && P ? P : null; } catch (error) { return null; } }

  function push(label, before) {
    const p = before || project();
    if (!p) return;
    rows.push({ label: label || '编辑', at: Date.now(), projectId: p.projectId, before: clone(p), after: null });
    if (rows.length > LIMIT) rows.shift();
    forward.length = 0;
  }

  function commit() {
    const row = rows.at(-1);
    if (row && project() && row.projectId === project().projectId) row.after = stamp(project());
  }

  function drop() { rows.pop(); }

  function describe() { return rows.at(-1)?.label || ''; }

  function undo(apply) {
    const row = rows.at(-1);
    const p = project();
    if (!row || !p) throw Error('没有可撤销的操作');
    if (row.projectId !== p.projectId) throw Error('已切换项目，无法撤销上一个项目');
    if (row.after && stamp(p) !== row.after) throw Error('后续内容已改变，暂不能撤销，避免覆盖新编辑');
    forward.push({ label: row.label, at: Date.now(), projectId: row.projectId, before: clone(p), after: row.after });
    rows.pop();
    return { label: row.label, project: row.before, apply };
  }

  function redo() {
    const row = forward.at(-1);
    const p = project();
    if (!row || !p) throw Error('没有可重做的操作');
    if (row.projectId !== p.projectId) throw Error('已切换项目，无法重做');
    rows.push({ label: row.label, at: Date.now(), projectId: row.projectId, before: clone(p), after: row.after });
    forward.pop();
    return { label: row.label, project: row.before };
  }

  window.frameUndo = {
    push, commit, drop, describe, undo, redo, stamp,
    get canUndo() { const row = rows.at(-1); return !!row && row.projectId === project()?.projectId; },
    get canRedo() { const row = forward.at(-1); return !!row && row.projectId === project()?.projectId; },
    get label() { return describe(); },
    get time() { const row = rows.at(-1); return row && row.projectId === project()?.projectId ? row.at : 0; },
    get size() { return rows.length; },
    reset() { rows.length = 0; forward.length = 0; }
  };
})();
