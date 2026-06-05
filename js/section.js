/* global TrelloPowerUp */
(function () {
  'use strict';

  const DATA_KEY = 'nestedChecklistData';
  const t = window.TrelloPowerUp.iframe();

  const els = {
    summary: document.getElementById('summary'),
    updated: document.getElementById('updated'),
    bar: document.getElementById('bar'),
    preview: document.getElementById('preview'),
    openEditorBtn: document.getElementById('openEditorBtn'),
  };

  function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
      id: String(item.id || ''),
      t: String(item.t || item.text || 'Без назви'),
      d: item.d || item.done ? 1 : 0,
      c: item.c || item.collapsed ? 1 : 0,
      ch: normalizeItems(item.ch || item.children || []),
    }));
  }

  function normalizeData(data) {
    if (!data || typeof data !== 'object') return { v: 1, i: [], u: null };
    return { v: 1, i: normalizeItems(data.i || data.items || []), u: data.u || data.updatedAt || null };
  }

  function countItems(items) {
    return (items || []).reduce((acc, item) => {
      acc.total += 1;
      if (item.d) acc.done += 1;
      const childCount = countItems(item.ch);
      acc.total += childCount.total;
      acc.done += childCount.done;
      return acc;
    }, { total: 0, done: 0 });
  }

  function topPreview(items) {
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Ще немає вкладених пунктів.';
      return empty;
    }

    const list = document.createElement('ul');
    items.slice(0, 6).forEach((item) => {
      const li = document.createElement('li');
      const mark = document.createElement('span');
      mark.className = item.d ? 'done mark' : 'mark';
      mark.textContent = item.d ? '☑' : '☐';
      const text = document.createElement('span');
      text.className = item.d ? 'done' : '';
      const childCount = countItems(item.ch).total;
      text.textContent = childCount ? `${item.t} · ${childCount} підп.` : item.t;
      li.append(mark, text);
      list.appendChild(li);
    });

    if (items.length > 6) {
      const extra = document.createElement('li');
      extra.className = 'muted';
      extra.textContent = `Ще ${items.length - 6} основн. пункт(ів)…`;
      list.appendChild(extra);
    }
    return list;
  }

  function openEditor() {
    return t.modal({
      title: 'Nested Checklist',
      url: t.signUrl('./nested.html'),
      height: 720,
      fullscreen: false,
      accentColor: '#0079BF',
    });
  }

  async function render() {
    const data = normalizeData(await t.get('card', 'shared', DATA_KEY, null));
    const stats = countItems(data.i);
    const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

    els.summary.textContent = stats.total ? `${stats.done}/${stats.total} виконано · ${percent}%` : '0 пунктів';
    els.updated.textContent = data.u ? `Оновлено: ${new Date(data.u).toLocaleString()}` : '';
    els.bar.style.width = `${percent}%`;
    els.preview.replaceChildren(topPreview(data.i));
    t.sizeTo(document.body).done();
  }

  els.openEditorBtn.addEventListener('click', openEditor);
  t.render(render);
}());
