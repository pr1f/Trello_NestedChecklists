/* global TrelloPowerUp */
(function () {
  'use strict';

  const DATA_KEY = 'nestedChecklistData';
  const SAVE_LIMIT = 4096;
  const WARN_LIMIT = 3500;
  const t = window.TrelloPowerUp.iframe();

  let state = { v: 1, i: [], u: null };
  let dirtyTimer = null;
  let focusAfterRender = null;

  const els = {
    summary: document.getElementById('summary'),
    newRootText: document.getElementById('newRootText'),
    addRootBtn: document.getElementById('addRootBtn'),
    expandAllBtn: document.getElementById('expandAllBtn'),
    collapseAllBtn: document.getElementById('collapseAllBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    clearDoneBtn: document.getElementById('clearDoneBtn'),
    closeBtn: document.getElementById('closeBtn'),
    status: document.getElementById('status'),
    limitMeter: document.getElementById('limitMeter'),
    importExportPanel: document.getElementById('importExportPanel'),
    jsonBox: document.getElementById('jsonBox'),
    applyImportBtn: document.getElementById('applyImportBtn'),
    hideJsonBtn: document.getElementById('hideJsonBtn'),
    emptyState: document.getElementById('emptyState'),
    tree: document.getElementById('tree'),
  };

  function makeId() {
    return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function makeItem(text) {
    return { id: makeId(), t: String(text || 'Новий пункт').trim() || 'Новий пункт', d: 0, c: 0, ch: [] };
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
    if (!data || typeof data !== 'object') return { v: 1, i: [], u: null };
    return {
      v: 1,
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

  function countChildren(item) {
    return countItems(item.ch || []).total;
  }

  function findItem(items, id, parentItems) {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item.id === id) return { item, items, index, parentItems };
      const found = findItem(item.ch || [], id, items);
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

  function removeDone(items) {
    return items
      .filter((item) => !item.d)
      .map((item) => ({ ...item, ch: removeDone(item.ch || []) }));
  }

  function setStatus(text, isError) {
    els.status.textContent = text;
    els.status.classList.toggle('error', Boolean(isError));
  }

  function updateSummary() {
    const stats = countItems(state.i);
    if (!stats.total) {
      els.summary.textContent = '0 пунктів';
      return;
    }
    const percent = Math.round((stats.done / stats.total) * 100);
    els.summary.textContent = `${stats.done}/${stats.total} виконано · ${percent}%`;
  }

  function updateLimitMeter() {
    const size = JSON.stringify(state).length;
    els.limitMeter.hidden = size < WARN_LIMIT;
    els.limitMeter.textContent = `Розмір даних: ${size}/${SAVE_LIMIT} символів. Trello може відхилити збереження після ~4096 символів.`;
    els.limitMeter.classList.toggle('danger', size > SAVE_LIMIT - 250);
  }

  function render() {
    updateSummary();
    updateLimitMeter();
    els.tree.replaceChildren();
    els.emptyState.hidden = state.i.length > 0;

    const fragment = document.createDocumentFragment();
    renderItems(state.i, fragment, 0);
    els.tree.appendChild(fragment);

    if (focusAfterRender) {
      const input = els.tree.querySelector(`[data-focus-id="${focusAfterRender}"]`);
      if (input) {
        input.focus();
        input.select();
      }
      focusAfterRender = null;
    }

    t.sizeTo(document.body).done();
  }

  function renderItems(items, container, depth) {
    items.forEach((item, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'node';

      const row = document.createElement('div');
      row.className = 'item-row';
      row.style.setProperty('--depth', depth);
      row.dataset.id = item.id;

      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'icon-button collapse-button';
      collapseBtn.dataset.action = 'toggle-collapse';
      collapseBtn.dataset.id = item.id;
      collapseBtn.textContent = item.ch.length ? (item.c ? '▶' : '▼') : '·';
      collapseBtn.disabled = item.ch.length === 0;
      collapseBtn.title = item.c ? 'Розгорнути' : 'Згорнути';
      row.appendChild(collapseBtn);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(item.d);
      checkbox.dataset.action = 'toggle-done';
      checkbox.dataset.id = item.id;
      checkbox.title = 'Позначити виконаним';
      row.appendChild(checkbox);

      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.value = item.t;
      textInput.className = 'item-text';
      textInput.dataset.action = 'edit-text';
      textInput.dataset.id = item.id;
      textInput.dataset.focusId = item.id;
      textInput.placeholder = 'Назва пункту';
      row.appendChild(textInput);

      const meta = document.createElement('span');
      meta.className = 'meta';
      const childrenCount = countChildren(item);
      meta.textContent = childrenCount ? `${childrenCount} підп.` : '';
      row.appendChild(meta);

      row.appendChild(actionButton('+', 'add-child', item.id, 'Додати підпункт'));
      row.appendChild(actionButton('↑', 'move-up', item.id, 'Перемістити вище', index === 0));
      row.appendChild(actionButton('↓', 'move-down', item.id, 'Перемістити нижче', index === items.length - 1));
      row.appendChild(actionButton('×', 'delete', item.id, 'Видалити пункт'));

      wrapper.appendChild(row);

      if (!item.c && item.ch.length) {
        const children = document.createElement('div');
        children.className = 'children';
        renderItems(item.ch, children, depth + 1);
        wrapper.appendChild(children);
      }

      container.appendChild(wrapper);
    });
  }

  function actionButton(text, action, id, title, disabled) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button';
    button.dataset.action = action;
    button.dataset.id = id;
    button.title = title;
    button.textContent = text;
    button.disabled = Boolean(disabled);
    return button;
  }

  async function saveNow() {
    clearTimeout(dirtyTimer);
    dirtyTimer = null;
    state.u = new Date().toISOString();

    const size = JSON.stringify(state).length;
    if (size > SAVE_LIMIT) {
      setStatus('Не збережено: перевищено ліміт pluginData Trello. Скороти список або експортуй JSON.', true);
      updateLimitMeter();
      return;
    }

    setStatus('Збереження…');
    try {
      await t.set('card', 'shared', DATA_KEY, state);
      setStatus('Збережено');
      updateLimitMeter();
    } catch (error) {
      setStatus(`Помилка збереження: ${error && error.message ? error.message : String(error)}`, true);
    }
  }

  function queueSave() {
    clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(saveNow, 450);
    setStatus('Є незбережені зміни…');
  }

  function addRoot() {
    const text = els.newRootText.value.trim();
    if (!text) return;
    const item = makeItem(text);
    state.i.push(item);
    els.newRootText.value = '';
    focusAfterRender = item.id;
    render();
    saveNow();
  }

  function handleTreeClick(event) {
    const control = event.target.closest('[data-action]');
    if (!control) return;

    const action = control.dataset.action;
    const id = control.dataset.id;
    const found = findItem(state.i, id, null);
    if (!found) return;

    if (action === 'toggle-collapse') {
      found.item.c = found.item.c ? 0 : 1;
      render();
      saveNow();
      return;
    }

    if (action === 'add-child') {
      const child = makeItem('Новий підпункт');
      found.item.ch.push(child);
      found.item.c = 0;
      focusAfterRender = child.id;
      render();
      saveNow();
      return;
    }

    if (action === 'move-up' && found.index > 0) {
      const temp = found.items[found.index - 1];
      found.items[found.index - 1] = found.item;
      found.items[found.index] = temp;
      render();
      saveNow();
      return;
    }

    if (action === 'move-down' && found.index < found.items.length - 1) {
      const temp = found.items[found.index + 1];
      found.items[found.index + 1] = found.item;
      found.items[found.index] = temp;
      render();
      saveNow();
      return;
    }

    if (action === 'delete') {
      if (!window.confirm(`Видалити пункт «${found.item.t}» разом з усіма підпунктами?`)) return;
      found.items.splice(found.index, 1);
      render();
      saveNow();
    }
  }

  function handleTreeChange(event) {
    const control = event.target.closest('[data-action="toggle-done"]');
    if (!control) return;
    const found = findItem(state.i, control.dataset.id, null);
    if (!found) return;
    found.item.d = control.checked ? 1 : 0;
    render();
    saveNow();
  }

  function handleTreeInput(event) {
    const control = event.target.closest('[data-action="edit-text"]');
    if (!control) return;
    const found = findItem(state.i, control.dataset.id, null);
    if (!found) return;
    found.item.t = control.value;
    updateSummary();
    queueSave();
  }

  function showJsonPanel(mode) {
    els.importExportPanel.hidden = false;
    if (mode === 'export') {
      els.jsonBox.value = JSON.stringify(state, null, 2);
      els.jsonBox.focus();
      els.jsonBox.select();
    } else {
      els.jsonBox.value = '';
      els.jsonBox.placeholder = 'Встав JSON сюди та натисни «Застосувати імпорт»';
      els.jsonBox.focus();
    }
    t.sizeTo(document.body).done();
  }

  function applyImport() {
    try {
      const parsed = JSON.parse(els.jsonBox.value);
      const next = normalizeData(parsed);
      state = next;
      render();
      saveNow();
      setStatus('Імпорт застосовано');
    } catch (error) {
      setStatus('Невірний JSON. Імпорт не застосовано.', true);
    }
  }

  function clearDone() {
    if (!window.confirm('Видалити всі виконані пункти? Підпункти всередині виконаних пунктів теж будуть видалені.')) return;
    state.i = removeDone(state.i);
    render();
    saveNow();
  }

  async function load() {
    try {
      const data = await t.get('card', 'shared', DATA_KEY, null);
      state = normalizeData(data);
      render();
      setStatus('Готово');
    } catch (error) {
      setStatus(`Не вдалося завантажити дані: ${error && error.message ? error.message : String(error)}`, true);
    }
  }

  els.addRootBtn.addEventListener('click', addRoot);
  els.newRootText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addRoot();
  });
  els.tree.addEventListener('click', handleTreeClick);
  els.tree.addEventListener('change', handleTreeChange);
  els.tree.addEventListener('input', handleTreeInput);
  els.expandAllBtn.addEventListener('click', () => {
    mutateAll(state.i, (item) => { item.c = 0; });
    render();
    saveNow();
  });
  els.collapseAllBtn.addEventListener('click', () => {
    mutateAll(state.i, (item) => { if (item.ch.length) item.c = 1; });
    render();
    saveNow();
  });
  els.exportBtn.addEventListener('click', () => showJsonPanel('export'));
  els.importBtn.addEventListener('click', () => showJsonPanel('import'));
  els.applyImportBtn.addEventListener('click', applyImport);
  els.hideJsonBtn.addEventListener('click', () => {
    els.importExportPanel.hidden = true;
    t.sizeTo(document.body).done();
  });
  els.clearDoneBtn.addEventListener('click', clearDone);
  els.closeBtn.addEventListener('click', () => t.closeModal());

  load();
}());
