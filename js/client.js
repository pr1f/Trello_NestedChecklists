/* global TrelloPowerUp */
(function () {
  'use strict';

  const DATA_KEY = 'nestedChecklistData';
  const ICON = new URL('../assets/checklist.svg', document.currentScript.src).href;

  function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
      id: String(item.id || makeId()),
      t: String(item.t || item.text || 'Без назви'),
      d: item.d ? 1 : 0,
      c: item.c ? 1 : 0,
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

  function makeId() {
    return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function count(items) {
    return (items || []).reduce((acc, item) => {
      acc.total += 1;
      if (item.d) acc.done += 1;
      const childCount = count(item.ch);
      acc.total += childCount.total;
      acc.done += childCount.done;
      return acc;
    }, { total: 0, done: 0 });
  }

  function getProgressText(data) {
    const stats = count(normalizeData(data).i);
    if (!stats.total) return null;
    return `${stats.done}/${stats.total}`;
  }

  function openEditor(t) {
    return t.modal({
      title: 'Nested Checklist',
      url: t.signUrl('./nested.html'),
      height: 720,
      fullscreen: false,
      accentColor: '#0079BF',
    });
  }

  window.TrelloPowerUp.initialize({
    'card-buttons': function () {
      return [{
        icon: ICON,
        text: 'Nested Checklist',
        condition: 'edit',
        callback: openEditor,
      }];
    },

    'card-back-section': function (t) {
      return {
        title: 'Nested Checklist',
        icon: ICON,
        content: {
          type: 'iframe',
          url: t.signUrl('./section.html'),
          height: 260,
        },
        action: {
          text: 'Open editor',
          callback: openEditor,
        },
      };
    },

    'card-badges': function (t) {
      return t.get('card', 'shared', DATA_KEY, null).then((data) => {
        const text = getProgressText(data);
        if (!text) return [];
        const stats = count(normalizeData(data).i);
        return [{
          icon: ICON,
          text: `Nested ${text}`,
          color: stats.done === stats.total ? 'green' : 'blue',
        }];
      });
    },

    'card-detail-badges': function (t) {
      return t.get('card', 'shared', DATA_KEY, null).then((data) => {
        const text = getProgressText(data);
        if (!text) return [];
        const stats = count(normalizeData(data).i);
        return [{
          title: 'Nested Checklist',
          text: `${text} виконано`,
          color: stats.done === stats.total ? 'green' : 'blue',
          callback: openEditor,
        }];
      });
    },
  });
}());
