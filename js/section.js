/* global TrelloPowerUp */
(function () {
  'use strict';

  const DATA_KEY = 'nestedChecklistData';
  const DEFAULT_TITLE = 'Nested Checklist';
  const t = window.TrelloPowerUp.iframe();

  let state = { v: 4, ttl: DEFAULT_TITLE, ac: 0, i: [], u: null };

  const els = {
    summary: document.getElementById('summary'),
    updated: document.getElementById('updated'),
    bar: document.getElementById('bar'),
    preview: document.getElementById('preview'),
    renameBtn: document.getElementById('renameBtn'),
    openEditorBtn: document.getElementById('openEditorBtn'),
    masterToggle: document.getElementById('masterToggle'),
  };

  function makeId() {
    return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function makeItem(text) {
    return { id: makeId(), t: String(text || 'Новий підпункт').trim() || 'Новий підпункт', d: 0, c: 0, ch: [] };
  }

  function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
      id: String(item.id || makeId()),
      t: String(item.t || item.text || 'Без назви'),
      d: item.d || item.done ? 1 : 0,
      c: item.c || item.collapsed ? 1 : 0,
      ch: normalizeItems(item.ch || item.children || []),
    }));
  }

  function normalizeData(data) {
    if (!data || typeof data !== 'object') return { v: 4, ttl: DEFAULT_TITLE, ac: 0, i: [], u: null };
    return {
      v: 4,
      ttl: String(data.ttl || data.title || DEFAULT_TITLE).trim() || DEFAULT_TITLE,
      ac: data.ac ? 1 : 0,
      i: normalizeItems(data.i || data.items || []),
      u: data.u || data.updatedAt || null,
    };
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

  function getBranchState(item) {
    const stats = countItems([item]);
    return {
      total: stats.total,
      done: stats.done,
      checked: stats.total > 0 && stats.done === stats.total,
      partial: stats.done > 0 && stats.done < stats.total,
      percent: stats.total ? Math.round((stats.done / stats.total) * 100) : 0,
    };
  }

  function formatBranchProgress(item) {
    const childCount = countItems(item.ch || []).total;
    if (!childCount) return '';
    const branch = getBranchState(item);
    return `${branch.done}/${branch.total} · ${branch.percent}%`;
  }

  function findItem(items, id) {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item.id === id) return { item, items, index };
      const found = findItem(item.ch || [], id);
      if (found) return found;
    }
    return null;
  }

  function mutateAll(items, fn) {
    items.forEach((item) => {
      fn(item);
      mutateAll(item.ch || [], fn);
    });
  }

  function setDoneRecursive(item, done) {
    item.d = done ? 1 : 0;
    (item.ch || []).forEach((child) => setDoneRecursive(child, done));
  }

  function applyAutoCollapse() {
    if (!state.ac) return;
    mutateAll(state.i, (item) => {
      const branch = getBranchState(item);
      if (item.ch.length && branch.checked) item.c = 1;
    });
  }

  function setAllDone(done) {
    state.i.forEach((item) => setDoneRecursive(item, done));
  }

  function renderTree(items, container, depth) {
    items.forEach((item) => {
      const node = document.createElement('div');
      node.className = 'preview-node';

      const row = document.createElement('div');
      row.className = 'preview-row';
      row.style.setProperty('--depth', depth);

      const branch = getBranchState(item);

      if (item.ch.length) {
        const expandBtn = document.createElement('button');
        expandBtn.type = 'button';
        expandBtn.className = 'expand-btn';
        expandBtn.dataset.action = 'toggle-collapse';
        expandBtn.dataset.id = item.id;
        expandBtn.textContent = item.c ? '▶' : '▼';
        expandBtn.title = item.c ? 'Розгорнути' : 'Згорнути';
        row.appendChild(expandBtn);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'expand-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        row.appendChild(spacer);
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'mark';
      checkbox.dataset.action = 'toggle-done';
      checkbox.dataset.id = item.id;
      checkbox.checked = branch.checked;
      checkbox.indeterminate = branch.partial;
      row.appendChild(checkbox);

      const label = document.createElement('span');
      label.className = `preview-label${item.ch.length ? ' is-collapsible' : ''}`;
      if (item.ch.length) {
        label.dataset.action = 'toggle-collapse';
        label.dataset.id = item.id;
        label.title = item.c ? 'Розгорнути' : 'Згорнути';
      }

      const text = document.createElement('span');
      text.className = 'preview-text';
      if (branch.checked) text.classList.add('is-done');
      if (branch.partial) text.classList.add('is-partial');
      text.textContent = item.t;
      label.appendChild(text);

      const meta = document.createElement('span');
      meta.className = 'preview-meta';
      meta.textContent = formatBranchProgress(item);
      label.appendChild(meta);

      row.appendChild(label);

      const addChild = document.createElement('button');
      addChild.type = 'button';
      addChild.className = 'add-child-btn';
      addChild.dataset.action = 'add-child';
      addChild.dataset.id = item.id;
      addChild.textContent = '+';
      addChild.title = 'Додати підпункт';
      row.appendChild(addChild);

      node.appendChild(row);

      if (!item.c && item.ch.length) {
        const children = document.createElement('div');
        renderTree(item.ch, children, depth + 1);
        node.appendChild(children);
      }

      container.appendChild(node);
    });
  }

  function openEditor() {
    return t.modal({
      title: state.ttl || DEFAULT_TITLE,
      url: t.signUrl('./nested.html'),
      height: 760,
      fullscreen: false,
      accentColor: '#0079BF',
    });
  }

  async function saveAndRender() {
    state.u = new Date().toISOString();
    state.ttl = String(state.ttl || DEFAULT_TITLE).trim() || DEFAULT_TITLE;
    await t.set('card', 'shared', DATA_KEY, state);
    renderFromState();
  }

  function renderFromState() {
    const stats = countItems(state.i);
    const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

    els.summary.textContent = stats.total ? `${stats.done}/${stats.total} виконано · ${percent}%` : '0 пунктів';
    els.updated.textContent = state.u ? `Оновлено: ${new Date(state.u).toLocaleString()}` : '';
    els.bar.style.width = `${percent}%`;
    els.masterToggle.checked = stats.total > 0 && stats.done === stats.total;
    els.masterToggle.indeterminate = stats.done > 0 && stats.done < stats.total;

    const fragment = document.createDocumentFragment();
    if (!state.i.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Ще немає вкладених пунктів.';
      fragment.appendChild(empty);
    } else {
      renderTree(state.i, fragment, 0);
    }
    els.preview.replaceChildren(fragment);
    t.sizeTo(document.body).done();
  }

  async function load() {
    state = normalizeData(await t.get('card', 'shared', DATA_KEY, null));
    applyAutoCollapse();
    renderFromState();
  }

  async function handlePreviewClick(event) {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const action = control.dataset.action;
    const found = findItem(state.i, control.dataset.id);
    if (!found) return;

    if (action === 'toggle-collapse') {
      if (!found.item.ch.length) return;
      found.item.c = found.item.c ? 0 : 1;
      await saveAndRender();
      return;
    }

    if (action === 'add-child') {
      found.item.ch.push(makeItem('Новий підпункт'));
      found.item.c = 0;
      await saveAndRender();
    }
  }

  async function handlePreviewChange(event) {
    const control = event.target.closest('[data-action="toggle-done"]');
    if (!control) return;
    const found = findItem(state.i, control.dataset.id);
    if (!found) return;
    setDoneRecursive(found.item, control.checked);
    applyAutoCollapse();
    await saveAndRender();
  }

  async function renameChecklist() {
    const nextTitle = window.prompt('Нова назва checklist-а', state.ttl || DEFAULT_TITLE);
    if (nextTitle === null) return;
    const trimmed = String(nextTitle).trim() || DEFAULT_TITLE;
    state.ttl = trimmed;
    await saveAndRender();
  }

  async function toggleAll(event) {
    setAllDone(event.target.checked);
    applyAutoCollapse();
    await saveAndRender();
  }

  els.openEditorBtn.addEventListener('click', openEditor);
  els.renameBtn.addEventListener('click', renameChecklist);
  els.masterToggle.addEventListener('change', (event) => {
    toggleAll(event).catch(console.error);
  });
  els.preview.addEventListener('click', (event) => {
    handlePreviewClick(event).catch(console.error);
  });
  els.preview.addEventListener('change', (event) => {
    handlePreviewChange(event).catch(console.error);
  });
  t.render(load);
}());
