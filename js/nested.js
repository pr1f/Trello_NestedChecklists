/* global TrelloPowerUp */
(function () {
  'use strict';

  const DATA_KEY = 'nestedChecklistData';
  const SAVE_LIMIT = 4096;
  const WARN_LIMIT = 3500;
  const DEFAULT_TITLE = 'Nested Checklist';
  const t = window.TrelloPowerUp.iframe();

  let state = { v: 3, ttl: DEFAULT_TITLE, ac: 0, i: [], u: null };
  let dirtyTimer = null;
  let focusAfterRender = null;
  let draggingId = null;

  const els = {
    summary: document.getElementById('summary'),
    listTitle: document.getElementById('listTitle'),
    newRootText: document.getElementById('newRootText'),
    addRootBtn: document.getElementById('addRootBtn'),
    expandAllBtn: document.getElementById('expandAllBtn'),
    collapseAllBtn: document.getElementById('collapseAllBtn'),
    autoCollapseBtn: document.getElementById('autoCollapseBtn'),
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
    if (!data || typeof data !== 'object') return { v: 3, ttl: DEFAULT_TITLE, ac: 0, i: [], u: null };
    return {
      v: 3,
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
    return `${branch.done}/${branch.total} · ${branch.percent}% · ${childCount} підп.`;
  }

  function findItem(items, id, parent) {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item.id === id) return { item, items, index, parent: parent || null };
      const found = findItem(item.ch || [], id, item);
      if (found) return found;
    }
    return null;
  }

  function itemContains(item, id) {
    return (item.ch || []).some((child) => child.id === id || itemContains(child, id));
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

  function updateAutoCollapseButton() {
    els.autoCollapseBtn.textContent = state.ac ? 'Автозгортання: увімк.' : 'Автозгортання: вимк.';
  }

  function updateLimitMeter() {
    const size = JSON.stringify(state).length;
    els.limitMeter.hidden = size < WARN_LIMIT;
    els.limitMeter.textContent = `Розмір даних: ${size}/${SAVE_LIMIT} символів. Trello може відхилити збереження після ~4096 символів.`;
    els.limitMeter.classList.toggle('danger', size > SAVE_LIMIT - 250);
  }

  function render() {
    updateSummary();
    updateAutoCollapseButton();
    updateLimitMeter();
    if (document.activeElement !== els.listTitle) {
      els.listTitle.value = state.ttl || DEFAULT_TITLE;
    }

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

      const branchState = getBranchState(item);
      if (branchState.partial) row.classList.add('is-partial');
      if (draggingId === item.id) row.classList.add('is-dragging');

      const dragHandle = document.createElement('span');
      dragHandle.className = 'drag-handle';
      dragHandle.textContent = '☰';
      dragHandle.draggable = true;
      dragHandle.dataset.action = 'drag';
      dragHandle.dataset.id = item.id;
      dragHandle.title = 'Перетягни, щоб переставити пункт';
      row.appendChild(dragHandle);

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
      checkbox.checked = branchState.checked;
      checkbox.indeterminate = branchState.partial;
      checkbox.dataset.action = 'toggle-done';
      checkbox.dataset.id = item.id;
      checkbox.title = 'Позначити виконаним';
      row.appendChild(checkbox);

      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.value = item.t;
      textInput.className = 'item-text';
      if (branchState.checked) textInput.classList.add('is-done');
      textInput.dataset.action = 'edit-text';
      textInput.dataset.id = item.id;
      textInput.dataset.focusId = item.id;
      textInput.placeholder = 'Назва пункту';
      row.appendChild(textInput);

      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = formatBranchProgress(item);
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
    state.ttl = String(state.ttl || DEFAULT_TITLE).trim() || DEFAULT_TITLE;

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

  function addChildTo(id) {
    const found = findItem(state.i, id);
    if (!found) return;
    const child = makeItem('Новий підпункт');
    found.item.ch.push(child);
    found.item.c = 0;
    focusAfterRender = child.id;
    render();
    saveNow();
  }

  function addSiblingAfter(id) {
    const found = findItem(state.i, id);
    if (!found) return;
    const sibling = makeItem('Новий пункт');
    found.items.splice(found.index + 1, 0, sibling);
    focusAfterRender = sibling.id;
    render();
    saveNow();
  }

  function outdentItem(id) {
    const found = findItem(state.i, id);
    if (!found || !found.parent) return;
    const [item] = found.items.splice(found.index, 1);
    const parentFound = findItem(state.i, found.parent.id);
    if (!parentFound) return;
    parentFound.items.splice(parentFound.index + 1, 0, item);
    focusAfterRender = item.id;
    render();
    saveNow();
  }

  function moveItemBefore(dragId, targetId) {
    if (!dragId || !targetId || dragId === targetId) return false;
    const source = findItem(state.i, dragId);
    const target = findItem(state.i, targetId);
    if (!source || !target || itemContains(source.item, targetId)) return false;

    const [item] = source.items.splice(source.index, 1);
    const nextTarget = findItem(state.i, targetId);
    if (!nextTarget) {
      source.items.splice(source.index, 0, item);
      return false;
    }
    nextTarget.items.splice(nextTarget.index, 0, item);
    return true;
  }

  function handleTreeClick(event) {
    const control = event.target.closest('[data-action]');
    if (!control) return;

    const action = control.dataset.action;
    if (action === 'drag') return;

    const id = control.dataset.id;
    const found = findItem(state.i, id);
    if (!found) return;

    if (action === 'toggle-collapse') {
      found.item.c = found.item.c ? 0 : 1;
      render();
      saveNow();
      return;
    }

    if (action === 'add-child') {
      addChildTo(id);
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
    const found = findItem(state.i, control.dataset.id);
    if (!found) return;
    setDoneRecursive(found.item, control.checked);
    applyAutoCollapse();
    render();
    saveNow();
  }

  function handleTreeInput(event) {
    const control = event.target.closest('[data-action="edit-text"]');
    if (!control) return;
    const found = findItem(state.i, control.dataset.id);
    if (!found) return;
    found.item.t = control.value;
    updateSummary();
    queueSave();
  }

  function handleTreeKeydown(event) {
    const control = event.target.closest('[data-action="edit-text"]');
    if (!control) return;
    const id = control.dataset.id;

    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) addChildTo(id);
      else addSiblingAfter(id);
      return;
    }

    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      addChildTo(id);
      return;
    }

    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      outdentItem(id);
    }
  }

  function handleDragStart(event) {
    const handle = event.target.closest('[data-action="drag"]');
    if (!handle) return;
    draggingId = handle.dataset.id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggingId);
    render();
  }

  function handleDragOver(event) {
    const row = event.target.closest('.item-row');
    if (!row || !draggingId || row.dataset.id === draggingId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    row.classList.add('is-drop-target');
  }

  function handleDragLeave(event) {
    const row = event.target.closest('.item-row');
    if (row) row.classList.remove('is-drop-target');
  }

  function handleDrop(event) {
    const row = event.target.closest('.item-row');
    if (!row) return;
    event.preventDefault();
    const dragId = event.dataTransfer.getData('text/plain') || draggingId;
    const targetId = row.dataset.id;
    draggingId = null;
    if (moveItemBefore(dragId, targetId)) {
      render();
      saveNow();
    } else {
      render();
    }
  }

  function handleDragEnd() {
    draggingId = null;
    render();
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
      applyAutoCollapse();
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
      applyAutoCollapse();
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
  els.listTitle.addEventListener('input', () => {
    state.ttl = els.listTitle.value;
    queueSave();
  });
  els.listTitle.addEventListener('blur', () => {
    state.ttl = String(els.listTitle.value || DEFAULT_TITLE).trim() || DEFAULT_TITLE;
    els.listTitle.value = state.ttl;
    saveNow();
  });
  els.tree.addEventListener('click', handleTreeClick);
  els.tree.addEventListener('change', handleTreeChange);
  els.tree.addEventListener('input', handleTreeInput);
  els.tree.addEventListener('keydown', handleTreeKeydown);
  els.tree.addEventListener('dragstart', handleDragStart);
  els.tree.addEventListener('dragover', handleDragOver);
  els.tree.addEventListener('dragleave', handleDragLeave);
  els.tree.addEventListener('drop', handleDrop);
  els.tree.addEventListener('dragend', handleDragEnd);

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
  els.autoCollapseBtn.addEventListener('click', () => {
    state.ac = state.ac ? 0 : 1;
    applyAutoCollapse();
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
